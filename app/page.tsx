import {
  ArrowRight,
  BadgeCheck,
  Brain,
  CheckCircle2,
  Clapperboard,
  FileSearch,
  Gauge,
  KeyRound,
  Layers3,
  ListChecks,
  RadioTower,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const pipeline = [
  {
    label: "Research",
    title: "상위 영상 후보와 소스 수집",
    detail: "YouTube Finder와 수동 seed를 같은 run 안에 보관합니다.",
  },
  {
    label: "Evidence",
    title: "클레임 분리와 팩트체크",
    detail: "supported, needs evidence, opinion, do not use를 분리합니다.",
  },
  {
    label: "Package",
    title: "대본, 씬, 프롬프트 설계",
    detail: "영상 분석 결과를 스토리보드와 생성 프롬프트로 이어 붙입니다.",
  },
  {
    label: "Handoff",
    title: "승인 후 렌더와 업로드 큐",
    detail: "비용, OAuth, 배포 단계는 사람이 승인한 뒤 진행합니다.",
  },
];

const proofItems = [
  {
    icon: ShieldCheck,
    title: "위험한 단계는 멈춤",
    body: "외부 비용, 렌더, YouTube 업로드는 승인 게이트가 열리기 전까지 큐에 들어가지 않습니다.",
  },
  {
    icon: RadioTower,
    title: "채널별 운영",
    body: "브랜드 채널마다 OAuth, 기본 언어, 운영 메모리를 분리해 여러 채널을 한 화면에서 다룹니다.",
  },
  {
    icon: Brain,
    title: "성과가 다음 기획으로",
    body: "조회수, 댓글, A/B 로그, 채널 메모리 업데이트를 다음 실행의 판단 재료로 남깁니다.",
  },
];

const artifactColumns = [
  ["source-ledger.json", "analysis.md", "claim-ledger.md"],
  ["script-plan.md", "storyboard.json", "media-prompts.json"],
  ["render-plan.json", "publish-handoff.json", "youtube-upload-job.json"],
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams?: Promise<{ run?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  if (params.run) {
    redirect(`/dashboard?run=${encodeURIComponent(params.run)}`);
  }
  const user = await getCurrentUser();
  const primaryHref = user ? "/dashboard" : "/login";

  return (
    <main className="marketing-page" id="main-content">
      <nav className="marketing-nav" aria-label="주요 메뉴">
        <Link className="marketing-brand" href="/">
          <span className="marketing-brand-mark">YIF</span>
          <span>YouTube Idea Factory</span>
        </Link>
        <div className="marketing-nav-links">
          <Link href="/dashboard">작업장</Link>
          <Link href="/admin/channels">채널</Link>
          <Link href="/settings">제공자</Link>
          {user ? (
            <Link className="marketing-nav-cta" href="/me">
              내 계정
            </Link>
          ) : (
            <Link className="marketing-nav-cta" href="/login">
              로그인
            </Link>
          )}
        </div>
      </nav>

      <section className="marketing-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="hero-kicker">review-gated production cockpit</p>
          <h1 id="home-title">YouTube Idea Factory</h1>
          <p>
            여러 브랜드 채널의 리서치, 분석, 대본, 스토리보드, 생성, 렌더, 배포를 한 run으로 묶습니다.
            비용과 업로드 위험이 있는 단계는 승인 게이트가 열릴 때까지 멈춥니다.
          </p>
          <div className="hero-actions">
            <Link className="text-button primary" href={primaryHref}>
              작업장 열기
              <ArrowRight size={15} />
            </Link>
            <Link className="home-text-link" href="/admin/channels">
              채널 관리 보기
            </Link>
          </div>
        </div>

        <div className="home-gallery" aria-label="제작 실행 미리보기">
          <article className="gallery-card gallery-card-main">
            <div className="gallery-card-heading">
              <span>active production run</span>
              <strong>K-경제 뉴스 자동화</strong>
            </div>
            <div className="run-preview-grid">
              <div>
                <FileSearch size={18} />
                <span>sources</span>
                <strong>12</strong>
              </div>
              <div>
                <ShieldCheck size={18} />
                <span>claims</span>
                <strong>18</strong>
              </div>
              <div>
                <Clapperboard size={18} />
                <span>scenes</span>
                <strong>07</strong>
              </div>
            </div>
            <div className="workflow-lines">
              {pipeline.map((stage) => (
                <span key={stage.label}>
                  <CheckCircle2 size={14} />
                  {stage.title}
                </span>
              ))}
            </div>
          </article>

          <article className="gallery-card gallery-card-media">
            <div className="media-frame" />
            <div>
              <span>asset queue</span>
              <strong>이미지 8개, 영상 5개 검토 대기</strong>
            </div>
          </article>

          <article className="gallery-card gallery-card-dark">
            <KeyRound size={19} />
            <span>channel oauth</span>
            <strong>브랜드별 refresh token 분리</strong>
          </article>

          <article className="gallery-card gallery-card-list">
            <span>production package</span>
            <div className="artifact-columns">
              {artifactColumns.map((column) => (
                <div key={column.join("-")}>
                  {column.map((item) => (
                    <code key={item}>{item}</code>
                  ))}
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="home-proof-strip" aria-label="운영 기준">
        <div>
          <BadgeCheck size={17} />
          <span>source links preserved</span>
        </div>
        <div>
          <Gauge size={17} />
          <span>cost gates before generation</span>
        </div>
        <div>
          <Layers3 size={17} />
          <span>artifacts stay inside each run</span>
        </div>
      </section>

      <section className="marketing-section">
        <div className="section-heading">
          <h2>자동화보다 중요한 것은 멈출 수 있는 구조입니다.</h2>
          <p>
            스킬은 판단을 돕고, 스크립트와 어댑터는 반복 작업을 고정합니다. 결과물은 산출물 편집기와
            워커 큐에서 추적 가능한 형태로 남습니다.
          </p>
        </div>
        <div className="feature-masonry">
          {proofItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <article className={`feature-tile tile-${index + 1}`} key={item.title}>
                <Icon size={22} />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            );
          })}
          <article className="feature-tile wide">
            <div>
              <ListChecks size={22} />
              <h3>실행마다 남는 제작 패키지</h3>
            </div>
            <p>
              source ledger, claim ledger, script plan, storyboard, asset manifest, render plan,
              publish handoff가 한 run에 묶입니다. 운영자는 어느 단계가 막혔는지 바로 확인할 수 있습니다.
            </p>
          </article>
        </div>
      </section>

      <section className="pipeline-strip" aria-label="콘텐츠 제작 순서">
        {pipeline.map((item, index) => (
          <article className="pipeline-strip-item" key={item.label}>
            <span>{String(index + 1).padStart(2, "0")} / {item.label}</span>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="marketing-cta">
        <div>
          <h2>다음 실행부터 브랜드 채널별로 분리하세요.</h2>
          <p>
            채널 OAuth, 제공자 설정, 승인 게이트를 먼저 정리하면 생성 비용과 업로드 리스크를 통제할 수 있습니다.
          </p>
        </div>
        <Link className="text-button primary" href="/admin/channels">
          채널 관리 시작
          <ArrowRight size={15} />
        </Link>
      </section>

      <footer className="marketing-footer">
        <span>YouTube Idea Factory</span>
        <div>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/settings">Settings</Link>
          <Link href="/login">Login</Link>
        </div>
      </footer>
    </main>
  );
}
