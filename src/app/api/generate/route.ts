import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (options: { data: Buffer }) => {
    load: () => Promise<unknown>;
    getText: (opts?: { normalizeWhitespace?: boolean }) => Promise<{
      text: string;
      pages: Array<{ text: string; num: number }>;
    }>;
  };
};

const MINIMAX_API_URL = "https://api.minimax.io/v1/text/chatcompletion_v2";

async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".pdf")) {
    try {
      const parser = new PDFParse({ data: buffer });
      await parser.load();
      const result = await parser.getText({ normalizeWhitespace: true });
      return result.text || "";
    } catch (err) {
      throw new Error(
        `Failed to parse PDF: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
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
    const minimaxApiKeyFromSession = formData.get("minimaxApiKey") as string | null;
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
      let extractedCvText = "";
      try {
        extractedCvText = await extractTextFromFile(cvFile);
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to read CV file.",
          },
          { status: 400 }
        );
      }

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
        try {
          const extractedText = await extractTextFromFile(file);
          return {
            name: file.name,
            text: extractedText,
          };
        } catch {
          return {
            name: file.name,
            text: "",
          };
        }
      })
    );

    const validReferences = parsedReferences.filter((file) => file.text.trim().length > 0);

    const referencesBlock = validReferences.length
      ? validReferences
          .map((file, index) => `Reference ${index + 1} (${file.name}):\n${file.text}`)
          .join("\n\n---\n\n")
      : "No additional reference documents were provided.";

    const systemPrompt = `You are an expert career consultant and professional CV writer. Your job is to tailor a candidate's CV and write a compelling, unique cover letter specifically for the job they are applying to.

Strict factuality rules:
- Use only information explicitly present in the provided CV and reference documents
- Never invent or infer specific achievements, titles, dates, technologies, certifications, employers, or metrics
- If information needed for a claim is missing, omit the claim rather than guessing
- Keep all factual information accurate and verifiable from the provided documents

When tailoring the CV:
- Highlight relevant experience and skills that match the job requirements
- Reorder sections to put the most relevant information first
- Use keywords from the job description naturally
- Format the output as clean, professional text with clear section headings

When writing the cover letter:
- Write in a professional, enthusiastic and genuinely personal tone — make it feel unique to this specific candidate and job, not generic
- Reference specific requirements from the job description using concrete language from it
- Connect the candidate's experience to the role's needs, only using provided facts
- Keep it to 3-4 concise paragraphs
- Include a strong, memorable opening and a confident closing`;

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
2. A professional, unique cover letter for this application

Non-negotiable requirement: do not fabricate anything. Use only facts present in the CV or reference documents. Make the cover letter feel personal and specific, not generic.`;

    const minimaxApiKey = (minimaxApiKeyFromSession?.trim() || process.env.MINIMAX_API_KEY || "").trim();

    if (!minimaxApiKey) {
      return NextResponse.json(
        { error: "MiniMax API key is required" },
        { status: 400 }
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
        temperature: 0.9,
        max_completion_tokens: 8192,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "cv_and_cover_letter",
            description:
              "Tailored CV and cover letter for the job application",
            schema: {
              type: "object",
              properties: {
                tailoredCV: {
                  type: "string",
                  description:
                    "The complete tailored CV text, using \\n for line breaks",
                },
                coverLetter: {
                  type: "string",
                  description:
                    "The complete cover letter text, using \\n for line breaks",
                },
              },
              required: ["tailoredCV", "coverLetter"],
            },
          },
        },
      }),
    });

    if (!completion.ok) {
      const errorText = await completion.text();
      console.error("MiniMax API error:", errorText);
      return NextResponse.json(
        { error: "MiniMax request failed. Check API key and account balance." },
        { status: 502 }
      );
    }

    const completionData = (await completion.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      base_resp?: { status_code?: number; status_msg?: string };
    };

    // Check for API-level errors
    if (completionData.base_resp?.status_code && completionData.base_resp.status_code !== 0) {
      console.error("MiniMax base_resp error:", completionData.base_resp);
      return NextResponse.json(
        {
          error: `MiniMax API error: ${completionData.base_resp.status_msg || "Unknown error"} (code ${completionData.base_resp.status_code})`,
        },
        { status: 502 }
      );
    }

    const content = completionData.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Failed to generate content. The model returned an empty response." },
        { status: 500 }
      );
    }

    // With response_format json_schema, the model returns valid JSON directly.
    // Still handle markdown fences as a fallback for older behaviour.
    const normalized = content.trim();
    const jsonCandidate = normalized.startsWith("```")
      ? normalized.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "")
      : normalized;

    let result: { tailoredCV?: string; coverLetter?: string };
    try {
      result = JSON.parse(jsonCandidate) as { tailoredCV?: string; coverLetter?: string };
    } catch {
      console.error("JSON parse error. Raw content:", content.substring(0, 500));
      return NextResponse.json(
        { error: "Model returned invalid JSON. Please try again." },
        { status: 502 }
      );
    }

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
