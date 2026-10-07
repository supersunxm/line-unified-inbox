import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeReviewCandidatesFromVision,
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


test("Vision recovers two Google review cards when one date OCR is imperfect", () => {
  const annotation: VisionFullTextAnnotation = {
    text: [
      "สุทา วงศกรา",
      "1 รีวิว",
      "3 สัปดาห์ทีแลว",
      "มีเครื่องให้เลือกเยอะ พนักงานแนะนำจนได้เครื่องที่ถูกใจ",
      "OPPO A6c",
      "กดค้างเพื่อแสดงความรู้สึก",
      "วินนา สินวลจันทร์",
      "Local Guide · 1 รีวิว",
      "2 เดือนที่แล้ว",
      "ขอบคุณน้องๆให้คำแนะนำสเปกเครื่องอย่างดี",
    ].join("\n"),
    pages: [
      {
        width: 705,
        height: 1536,
        blocks: [
          {
            paragraphs: [
              paragraph("สุทา วงศกรา", 330, 354),
              paragraph("1 รีวิว", 365, 389),
              paragraph("3 สัปดาห์ทีแลว", 405, 431),
              paragraph(
                "มีเครื่องให้เลือกเยอะ พนักงานแนะนำจนได้เครื่องที่ถูกใจ",
                455,
                486,
              ),
              paragraph("OPPO A6c", 610, 666, 190, 420),
              paragraph("กดค้างเพื่อแสดงความรู้สึก", 790, 818),
              paragraph("วินนา สินวลจันทร์", 990, 1016),
              paragraph("Local Guide · 1 รีวิว", 1028, 1052),
              paragraph("2 เดือนที่แล้ว", 1070, 1096),
              paragraph(
                "ขอบคุณน้องๆให้คำแนะนำสเปกเครื่องอย่างดี",
                1118,
                1148,
              ),
            ],
          },
        ],
      },
    ],
  };

  const analysis = analyzeReviewCandidatesFromVision(annotation);

  assert.equal(analysis.estimatedReviewCount, 2);
  assert.equal(analysis.candidates.length, 2);
  assert.equal(
    analysis.candidates[0].text,
    "มีเครื่องให้เลือกเยอะ พนักงานแนะนำจนได้เครื่องที่ถูกใจ",
  );
  assert.equal(
    analysis.candidates[1].text,
    "ขอบคุณน้องๆให้คำแนะนำสเปกเครื่องอย่างดี",
  );
  assert.equal(
    analysis.candidates.some((candidate) => candidate.text.includes("OPPO A6c")),
    false,
  );
});

test("Vision preserves the full multiline English review with a NEW badge", () => {
  const expected =
    "Very nice and polite employees, they speak very good English and now everything from the products in the store. Also help you to choose witch product is the best for you. I recommend this store to everyone who appreciates nice service. Will come back to this store!";

  const annotation: VisionFullTextAnnotation = {
    text: [
      "marcel van oldenbeek",
      "Local Guide · 25 reviews · 6 photos",
      "★★★★★ 15 hours ago NEW",
      "Very nice and polite employees, they speak very good",
      "English and now everything from the products in the",
      "store. Also help you to choose witch product is the",
      "best for you. I recommend this store to everyone who",
      "appreciates nice service. Will come back to this store!",
    ].join("\n"),
    pages: [
      {
        width: 705,
        height: 900,
        blocks: [
          {
            paragraphs: [
              paragraph("marcel van oldenbeek", 70, 92),
              paragraph("Local Guide · 25 reviews · 6 photos", 96, 118),
              paragraph("★★★★★ 15 hours ago NEW", 126, 148),
              paragraph(
                "Very nice and polite employees, they speak very good",
                158,
                178,
              ),
              paragraph(
                "English and now everything from the products in the",
                180,
                200,
              ),
              paragraph(
                "store. Also help you to choose witch product is the",
                202,
                222,
              ),
              paragraph(
                "best for you. I recommend this store to everyone who",
                224,
                244,
              ),
              paragraph(
                "appreciates nice service. Will come back to this store!",
                246,
                266,
              ),
            ],
          },
        ],
      },
    ],
  };

  const analysis = analyzeReviewCandidatesFromVision(annotation);

  assert.equal(analysis.estimatedReviewCount, 1);
  assert.equal(analysis.candidates.length, 1);
  assert.equal(analysis.candidates[0].text, expected);
  assert.equal(analysis.candidates[0].text.includes("NEW"), false);
  assert.ok((analysis.candidates[0].confidence ?? 0) > 0.9);
});

test("Vision plain-text fallback keeps multiline review body and stops at photo overlay", () => {
  const annotation: VisionFullTextAnnotation = {
    text: [
      "Local Guide · 25 reviews · 6 photos",
      "★★★★★ 15 hours ago NEW",
      "Very nice and polite employees, they speak very good",
      "English and now everything from the products in the store.",
      "Will come back to this store!",
      "OPPO Reno14 Pro",
    ].join("\n"),
    pages: [],
  };

  const candidates = extractReviewCandidatesFromVision(annotation);

  assert.equal(candidates.length, 1);
  assert.equal(
    candidates[0].text,
    "Very nice and polite employees, they speak very good English and now everything from the products in the store. Will come back to this store!",
  );
  assert.equal(candidates[0].text.includes("NEW"), false);
  assert.equal(candidates[0].text.includes("OPPO Reno14 Pro"), false);
});

test("Vision reports a higher estimated card count when one body cannot be extracted", () => {
  const annotation: VisionFullTextAnnotation = {
    pages: [
      {
        width: 705,
        height: 1536,
        blocks: [
          {
            paragraphs: [
              paragraph("1 รีวิว", 300, 324),
              paragraph("3 สัปดาห์ที่แล้ว", 340, 366),
              paragraph(
                "มีเครื่องให้เลือกเยอะ พนักงานแนะนำดี",
                390,
                420,
              ),
              paragraph("1 รีวิว", 920, 944),
              paragraph("2 เดือนที่แล้ว", 960, 986),
            ],
          },
        ],
      },
    ],
  };

  const analysis = analyzeReviewCandidatesFromVision(annotation);

  assert.equal(analysis.estimatedReviewCount, 2);
  assert.equal(analysis.candidates.length, 1);
});
