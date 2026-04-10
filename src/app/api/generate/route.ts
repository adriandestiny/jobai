import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const jobDescription = formData.get("jobDescription") as string;
    const cvFile = formData.get("cv") as File | null;
    const cvText = formData.get("cvText") as string | null;

    if (!jobDescription) {
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 }
      );
    }

    let resumeContent = cvText || "";

    if (cvFile && cvFile.size > 0) {
      const buffer = Buffer.from(await cvFile.arrayBuffer());
      if (cvFile.name.endsWith(".pdf")) {
        const parsed = await pdfParse(buffer);
        resumeContent = parsed.text;
      } else {
        resumeContent = buffer.toString("utf-8");
      }
    }

    if (!resumeContent.trim()) {
      return NextResponse.json(
        { error: "CV content is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an expert career consultant and professional CV writer. Your job is to tailor a candidate's CV and write a compelling cover letter specifically for a job they are applying to.

When tailoring the CV:
- Highlight relevant experience and skills that match the job requirements
- Reorder sections to put the most relevant information first
- Use keywords from the job description naturally
- Keep all factual information accurate - never fabricate experience
- Format the output as clean, professional text

When writing the cover letter:
- Write in a professional, enthusiastic tone
- Reference specific requirements from the job description
- Connect the candidate's experience to the role's needs
- Keep it to 3-4 concise paragraphs
- Include a strong opening and closing`;

    const userPrompt = `Here is the candidate's CV:

---
${resumeContent}
---

Here is the job description they are applying for:

---
${jobDescription}
---

Please provide:
1. A tailored CV optimized for this specific job
2. A professional cover letter for this application

Format your response as JSON with two fields:
- "tailoredCV": the complete tailored CV as a string (use \\n for line breaks)
- "coverLetter": the complete cover letter as a string (use \\n for line breaks)`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content;
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
