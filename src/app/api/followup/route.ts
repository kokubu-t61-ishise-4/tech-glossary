import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

function getGroqClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
}

export async function POST(request: NextRequest) {
  try {
    const { term, definition, question } = await request.json();

    if (!question) {
      return NextResponse.json({ error: "質問を入力してください" }, { status: 400 });
    }

    const groq = getGroqClient();

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "あなたはデータエンジニアリングの専門家です。ユーザーが用語の説明について追加の質問をしています。分かりやすく簡潔に回答してください。日本語で200文字以内で回答してください。",
        },
        {
          role: "user",
          content: `用語「${term}」について、以下の説明がありました：

「${definition}」

この説明に関して質問があります：${question}`,
        },
      ],
      temperature: 0.3,
    });

    const answer = completion.choices[0]?.message?.content || "";

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Groq API error:", error);
    return NextResponse.json({ error: "AIによる回答に失敗しました" }, { status: 500 });
  }
}
