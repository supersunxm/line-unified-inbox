import assert from "node:assert/strict";
import test from "node:test";
import {
  extractReviewCandidatesFromVision,
  VisionFullTextAnnotation,
} from "./review15-vision-layout";

function paragraph(
  text: string,
  top: number,
  bottom: number,
  left = 32,
  right = 660,
  confidence = 0.98,
) {
  return {
    confidence,
    boundingBox: {
      vertices: [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
      ],
    },
    words: text.split(/\s+/).map((word) => ({
      confidence,
      symbols: Array.from(word).map((symbol) => ({
        text: symbol,
        confidence,
      })),
    })),
  };
}

test("Vision layout extractor stops before text printed on product photos", () => {
  const annotation: VisionFullTextAnnotation = {
    text: "3 สัปดาห์ที่แล้ว\nขอบคุณน้องๆ ให้คำแนะนำสเปกเครื่องอย่างดี\nOPPO A6c",
    pages: [
      {
        width: 705,
        height: 1536,
        blocks: [
          {
            paragraphs: [
              paragraph("3 สัปดาห์ที่แล้ว", 430, 458),
              paragraph(
                "ขอบคุณน้องๆ ให้คำแนะนำสเปกเครื่องอย่างดี",
                484,
                514,
              ),
              paragraph("OPPO A6c", 620, 682, 190, 430),
            ],
          },
        ],
      },
    ],
  };

  const candidates = extractReviewCandidatesFromVision(annotation);
  assert.equal(candidates.length, 1);
  assert.equal(
    candidates[0].text,
    "ขอบคุณน้องๆ ให้คำแนะนำสเปกเครื่องอย่างดี",
  );
  assert.ok((candidates[0].confidence ?? 0) > 0.9);
});

test("Vision layout extractor separates multiple review cards", () => {
  const annotation: VisionFullTextAnnotation = {
    pages: [
      {
        width: 705,
        height: 1800,
        blocks: [
          {
            paragraphs: [
              paragraph("1 เดือนที่แล้ว", 220, 248),
              paragraph(
                "บริการดีมากคับ ส่วนลดเยอะ ของแถมเยอะ ประทับใจมากคับ",
                276,
                308,
              ),
              paragraph("See translation English", 330, 352),
              paragraph("1 เดือนที่แล้ว", 880, 908),
              paragraph(
                "พนักงานให้คำแนะนำดีมาก ของแถมเยอะมาก",
                936,
                968,
              ),
              paragraph(
                "ใช้บัตรประชาชนใบเดียว คุยข้อมูลให้ทุกอย่าง",
                978,
                1008,
              ),
              paragraph("OPPO Reno16 5G", 1150, 1210, 240, 520),
            ],
          },
        ],
      },
    ],
  };

  const candidates = extractReviewCandidatesFromVision(annotation);
  assert.equal(candidates.length, 2);
  assert.equal(
    candidates[0].text,
    "บริการดีมากคับ ส่วนลดเยอะ ของแถมเยอะ ประทับใจมากคับ",
  );
  assert.equal(
    candidates[1].text,
    "พนักงานให้คำแนะนำดีมาก ของแถมเยอะมาก ใช้บัตรประชาชนใบเดียว คุยข้อมูลให้ทุกอย่าง",
  );
});

test("Vision plain-text fallback stays bounded", () => {
  const annotation: VisionFullTextAnnotation = {
    text: [
      "Reviews",
      "3 สัปดาห์ที่แล้ว",
      "มีเครื่องให้เลือกเยอะ พนักงานแนะนำจนได้เครื่องที่ถูกใจ",
      "OPPO A6c",
      "PROMOTION 50%",
    ].join("\n"),
    pages: [],
  };

  const candidates = extractReviewCandidatesFromVision(annotation);
  assert.equal(candidates.length, 1);
  assert.equal(
    candidates[0].text,
    "มีเครื่องให้เลือกเยอะ พนักงานแนะนำจนได้เครื่องที่ถูกใจ",
  );
});
