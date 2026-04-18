import { ImageResponse } from "next/og";
import { profileData } from "@/lib/data";
import { tierForScore } from "@/lib/scoring/rubric";

export const runtime = "nodejs";
// Cache for 5 minutes per login.
export const revalidate = 300;

type Params = { login: string };

export async function GET(
  _req: Request,
  ctx: { params: Promise<Params> },
) {
  const { login } = await ctx.params;
  const data = await profileData(login);

  const width = 1200;
  const height = 630;

  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            width,
            height,
            background: "#F5EEDC",
            color: "#1A1A1E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "monospace",
            fontSize: 56,
          }}
        >
          ? {login} ?
        </div>
      ),
      { width, height },
    );
  }

  const tier = tierForScore(data.score);

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          background: "#F5EEDC",
          color: "#1A1A1E",
          padding: 60,
          fontFamily: "monospace",
          border: "8px solid #1A1A1E",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 18,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          <span>Rate My GitHub</span>
          <span>Rubric v1</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40,
            marginTop: 60,
          }}
        >
          <img
            src={data.avatar}
            alt=""
            width={180}
            height={180}
            style={{
              border: "6px solid #1A1A1E",
              background: "#F5EEDC",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 28, opacity: 0.7 }}>github.com/</span>
            <span style={{ fontSize: 64, lineHeight: 1 }}>{data.login}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 40,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, textTransform: "uppercase", letterSpacing: 3, opacity: 0.7 }}>
              Overall
            </span>
            <span
              style={{
                fontSize: 220,
                lineHeight: 1,
                color: "#FF2E4C",
                fontWeight: 700,
              }}
            >
              {data.score.toFixed(1)}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 10,
            }}
          >
            <div
              style={{
                padding: "14px 28px",
                background: tier.color,
                color: "#1A1A1E",
                fontSize: 42,
                border: "6px solid #1A1A1E",
                letterSpacing: 2,
              }}
            >
              {data.tier} · {tier.name.toUpperCase()}
            </div>
            <span style={{ fontSize: 22, opacity: 0.7 }}>
              Top {data.percentile.toFixed(1)}%
            </span>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 60,
            right: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 16,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <span>Built using AliasKit — identity infra for AI agents</span>
          <span>aliaskit.com</span>
        </div>
      </div>
    ),
    { width, height },
  );
}
