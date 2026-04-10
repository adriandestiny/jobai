import { NextRequest, NextResponse } from "next/server";
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;

const MINIMAX_API_URL = "https://api.minimax.io/v1/text/chatcompletion_v2";

async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".pdf")) {
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
    return buffer.toString("utf-8");
  }

  return "";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const jobDescription = formData.get("jobDescription") as string;
    const cvFile = formData.get("cv") as File | null;
    const cvText = formData.get("cvText") as string | null;
    const referenceFiles = formData
      .getAll("references")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!jobDescription) {
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 }
      );
    }

    let resumeContent = cvText || "";

    if (cvFile && cvFile.size > 0) {
      const extractedCvText = await extractTextFromFile(cvFile);
      if (!extractedCvText.trim()) {
        return NextResponse.json(
          { error: "Unsupported CV file type. Use PDF, TXT, or MD." },
          { status: 400 }
        );
      }
      resumeContent = extractedCvText;
    }

    if (!resumeContent.trim()) {
      return NextResponse.json(
        { error: "CV content is required" },
        { status: 400 }
      );
    }

    const parsedReferences = await Promise.all(
      referenceFiles.map(async (file) => {
        const extractedText = await extractTextFromFile(file);
        return {
          name: file.name,
          text: extractedText,
        };
      })
    );

    const validReferences = parsedReferences.filter((file) => file.text.trim().length > 0);

    const referencesBlock = validReferences.length
      ? validReferences
          .map((file, index) => `Reference ${index + 1} (${file.name}):\n${file.text}`)
          .join("\n\n---\n\n")
      : "No additional reference documents were provided.";

    const systemPrompt = `You are an expert career consultant and professional CV writer. Your job is to tailor a candidate's CV and write a compelling cover letter specifically for a job they are applying to.

Strict factuality rules:
- Use only information explicitly present in the provided CV and reference documents
- Never invent or infer specific achievements, titles, dates, technologies, certifications, employers, or metrics
- If information needed for a claim is missing, omit the claim rather than guessing
- Keep all factual information accurate and verifiable from the provided documents

When tailoring the CV:
- Highlight relevant experience and skills that match the job requirements
- Reorder sections to put the most relevant information first
- Use keywords from the job description naturally
- Format the output as clean, professional text

When writing the cover letter:
- Write in a professional, enthusiastic tone
- Reference specific requirements from the job description
- Connect the candidate's experience to the role's needs, only using provided facts
- Keep it to 3-4 concise paragraphs
- Include a strong opening and closing`;

    const userPrompt = `Here is the candidate's CV:

---
${resumeContent}
---

Here are additional reference documents (if any):

---
${referencesBlock}
---

Here is the job description they are applying for:

---
${jobDescription}
---

Please provide:
1. A tailored CV optimized for this specific job
2. A professional cover letter for this application

Non-negotiable requirement: do not fabricate anything. Use only facts present in the CV or reference documents.

Format your response as JSON with two fields:
- "tailoredCV": the complete tailored CV as a string (use \\n for line breaks)
- "coverLetter": the complete cover letter as a string (use \\n for line breaks)`;

    const minimaxApiKey = process.env.MINIMAX_API_KEY;

    if (!minimaxApiKey) {
      return NextResponse.json(
        { error: "Server is missing MINIMAX_API_KEY" },
        { status: 500 }
      );
    }

    const completion = await fetch(MINIMAX_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${minimaxApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "MiniMax-Text-01",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!completion.ok) {
      const errorText = await completion.text();
      console.error("MiniMax API error:", errorText);
      return NextResponse.json(
        { error: "MiniMax request failed. Check token and balance." },
        { status: 502 }
      );
    }

    const completionData = (await completion.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = completionData.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Failed to generate content" },
        { status: 500 }
      );
    }

    const result = JSON.parse(content);

    return NextResponse.json({
      tailoredCV: result.tailoredCV || "",
      coverLetter: result.coverLetter || "",
    });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate documents. Please try again." },
      { status: 500 }
    );
  }
}
