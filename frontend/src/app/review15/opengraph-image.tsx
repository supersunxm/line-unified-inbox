import { ImageResponse } from "next/og";

export const alt = "ตรวจสอบรีวิว 15 คำ | OPPO Brand Shop";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const green = "#0a8f50";
const softGreen = "#eaf8f0";
const ink = "#141414";
const muted = "#5f6368";

function Feature({
  icon,
  line1,
  line2,
}: {
  icon: string;
  line1: string;
  line2: string;
}) {
  return (
    <div
      style={{
        width: 170,
        height: 92,
        borderRadius: 22,
        background: "rgba(234,248,240,0.92)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
      }}
    >
      <div style={{ fontSize: 29, fontWeight: 800, color: green }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: muted }}>{line1}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: muted }}>{line2}</div>
    </div>
  );
}

export default function Image() {
  const tokens = [
    "พนักงาน",
    "บริการ",
    "ดี",
    "มาก",
    "แนะนำ",
    "OPPO",
    "Reno",
    "5G",
    "ใช้งานง่าย",
    "กล้อง",
    "สวย",
    "ภาพคมชัด",
    "แบตอึด",
    "ร้านสะอาด",
    "คุ้มค่า",
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(120deg, #ffffff 0%, #f7fffb 55%, #a5e7bf 100%)",
          fontFamily: "sans-serif",
          color: ink,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 650,
            height: 650,
            borderRadius: 650,
            border: "55px solid rgba(17,151,91,0.05)",
            left: -245,
            top: -305,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: 520,
            background: "rgba(37,173,102,0.12)",
            right: -160,
            top: -190,
            display: "flex",
          }}
        />

        <div
          style={{
            width: 690,
            height: "100%",
            padding: "38px 0 34px 48px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 62,
                lineHeight: 0.8,
                fontWeight: 500,
                letterSpacing: -5,
              }}
            >
              oppo
            </div>
            <div style={{ marginTop: 12, fontSize: 22, fontWeight: 700 }}>
              Brand Shop
            </div>
          </div>

          <div
            style={{
              marginTop: 54,
              display: "flex",
              alignItems: "center",
              gap: 24,
            }}
          >
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: 110,
                background: green,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 50,
                fontWeight: 800,
              }}
            >
              •••
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.03 }}>
                ตรวจสอบรีวิว
              </div>
              <div
                style={{
                  marginTop: 5,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 16,
                }}
              >
                <span style={{ fontSize: 104, fontWeight: 900, color: green }}>
                  15
                </span>
                <span style={{ fontSize: 64, fontWeight: 900, color: green }}>
                  คำ
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 4, fontSize: 25, fontWeight: 700, color: muted }}>
            เช็กข้อความรีวิวให้ครบตามกฎ Review KPI
          </div>
          <div style={{ marginTop: 7, fontSize: 21, color: "#777" }}>
            ใช้งานฟรี • ไม่ต้องล็อกอิน
          </div>

          <div style={{ marginTop: 26, display: "flex", gap: 12 }}>
            <Feature icon="15" line1="นับคำ" line2="ตามกฎจริง" />
            <Feature icon="⚡" line1="รู้ผลทันที" line2="แบบ Real-time" />
            <Feature icon="✓" line1="ใช้งานง่าย" line2="บนมือถือ" />
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: 34,
            top: 20,
            width: 440,
            height: 690,
            borderRadius: 58,
            background: "#101010",
            border: "7px solid #3a3a3a",
            transform: "rotate(3deg)",
            padding: 14,
            display: "flex",
            boxShadow: "0 25px 55px rgba(0,0,0,0.24)",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 45,
              background: "#fff",
              padding: "30px 24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: -2 }}>
                oppo
              </div>
              <div style={{ fontSize: 30, fontWeight: 800 }}>≡</div>
            </div>

            <div
              style={{
                marginTop: 24,
                border: "2px solid #e8e8e8",
                borderRadius: 18,
                padding: "17px 18px",
                fontSize: 20,
                lineHeight: 1.45,
                color: "#222",
                display: "flex",
              }}
            >
              พนักงานบริการดีมาก แนะนำ OPPO Reno 5G ใช้งานง่าย กล้องสวย
              ภาพคมชัด แบตอึด ร้านสะอาด ราคาคุ้มค่า ประทับใจมาก
            </div>

            <div
              style={{
                marginTop: 18,
                background: softGreen,
                borderRadius: 21,
                padding: "20px 18px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 61, fontWeight: 900, color: green }}>
                  15
                </span>
                <span style={{ fontSize: 34, fontWeight: 800 }}>/ 15 คำ</span>
              </div>
              <div
                style={{
                  marginTop: 3,
                  fontSize: 23,
                  fontWeight: 800,
                  color: green,
                }}
              >
                ✓ ครบ 15 คำแล้ว
              </div>
            </div>

            <div style={{ marginTop: 19, fontSize: 20, fontWeight: 800 }}>
              คำที่ระบบนับ (15 คำ)
            </div>
            <div
              style={{
                marginTop: 11,
                display: "flex",
                flexWrap: "wrap",
                gap: 7,
              }}
            >
              {tokens.map((token) => (
                <div
                  key={token}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    background: softGreen,
                    color: "#17834f",
                    fontSize: 15,
                    display: "flex",
                  }}
                >
                  {token}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
