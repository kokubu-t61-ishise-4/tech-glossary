import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { term, context } = await request.json();

    if (!term) {
      return NextResponse.json({ error: "用語を入力してください" }, { status: 400 });
    }

    if (!context) {
      const checkCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "あなたはデータエンジニアリングの専門家です。与えられた用語について、IT/データエンジニアリングの文脈で複数の意味がありえるかを判定してください。必ずJSON形式のみで回答してください。",
          },
          {
            role: "user",
            content: `以下の用語について、IT/データエンジニアリングの文脈で複数の異なる意味や使われ方がありますか？

用語: ${term}

以下の形式でJSON形式で回答してください：
{
  "needsClarification": true または false,
  "reason": "複数の意味がある場合、その理由を簡潔に（例：「データベースの文脈とプログラミングの文脈で意味が異なります」）。明確な場合は空文字。",
  "possibleMeanings": ["意味1の簡潔な説明", "意味2の簡潔な説明"] または []
}

意味が明確で120%の確信がある場合のみneedsClarificationをfalseにしてください。
少しでも曖昧さがある場合はtrueにしてください。
JSONのみを出力し、他の説明は不要です。`,
          },
        ],
        temperature: 0.2,
      });

      const checkText = checkCompletion.choices[0]?.message?.content || "";
      const checkMatch = checkText.match(/\{[\s\S]*\}/);

      if (checkMatch) {
        const checkResult = JSON.parse(checkMatch[0]);
        if (checkResult.needsClarification) {
          return NextResponse.json({
            needsClarification: true,
            reason: checkResult.reason,
            possibleMeanings: checkResult.possibleMeanings || [],
          });
        }
      }
    }

    const contextPrompt = context
      ? `\n\n補足情報: ${context}`
      : "";

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "あなたはデータエンジニアリングの専門家です。用語の説明を求められたら、データエンジニアの新人向けに分かりやすく丁寧に説明してください。必ずJSON形式のみで回答してください。",
        },
        {
          role: "user",
          content: `以下の用語について説明してください。

用語: ${term}${contextPrompt}

以下の形式でJSON形式で回答してください：
{
  "definition": "用語の詳しい説明（300〜500文字程度、日本語で、専門用語を避けて平易に。何のためにあるのか、どう役立つのかも含めて文章でしっかり説明する）",
  "category": "カテゴリ（データベース, ETL, クラウド, プログラミング, データ分析, インフラ, その他 のいずれか）",
  "usage_scenarios": [
    "使用場面1（どんな状況で、どのような形で使われるか具体的に。例：「データウェアハウスを構築する際に、〇〇として使用される」）",
    "使用場面2",
    "使用場面3"
  ],
  "examples": [
    "具体例1（実際のツール名、サービス名、コマンド例など）",
    "具体例2",
    "具体例3"
  ]
}

JSONのみを出力し、他の説明は不要です。`,
        },
      ],
      temperature: 0.3,
    });

    const text = completion.choices[0]?.message?.content || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AIの応答を解析できませんでした" }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      needsClarification: false,
      definition: parsed.definition,
      category: parsed.category,
      usage_scenarios: parsed.usage_scenarios || [],
      examples: parsed.examples || [],
    });
  } catch (error) {
    console.error("Groq API error:", error);
    return NextResponse.json({ error: "AIによる検索に失敗しました" }, { status: 500 });
  }
}
