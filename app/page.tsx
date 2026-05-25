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
    detail: "YouTube Finder와 수동 입력 소스를 같은 제작 기록 안에 보관합니다.",
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
    label: "승인 전달",
    title: "승인 후 영상 조립과 업로드",
    detail: "비용, OAuth, 배포 단계는 사람이 승인한 뒤 진행합니다.",
  },
];

const proofItems = [
  {
    icon: ShieldCheck,
    title: "위험한 단계는 멈춤",
    body: "외부 비용, 영상 조립, YouTube 업로드는 사람이 승인하기 전까지 작업 목록에 들어가지 않습니다.",
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

const commandTiles = [
  {
    label: "gate",
    title: "승인 전 비용 차단",
    detail: "생성, 영상 조립, 업로드는 사람이 승인할 때만 다음 작업으로 넘어갑니다.",
  },
  {
    label: "channel",
    title: "브랜드별 권한 분리",
    detail: "업로드 토큰과 Analytics 토큰을 채널 단위로 보관합니다.",
  },
  {
    label: "memory",
    title: "성과가 다음 기획으로",
    detail: "성과 스냅샷과 채널 메모리가 다음 기획의 근거가 됩니다.",
  },
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
          <Link href="/settings">API 설정</Link>
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
        <div className="home-gallery command-deck-scene" aria-label="제작 관제실 미리보기">
          <div className="deck-shell">
            <div className="deck-status-bar">
              <span>실시간 제작 기록</span>
              <strong>K-경제 뉴스 자동화</strong>
              <em>review locked</em>
            </div>
            <div className="deck-grid">
              <article className="deck-main-screen">
                <div className="deck-screen-head">
                  <span>제작 패키지</span>
                  <strong>소스부터 업로드 준비까지</strong>
                </div>
                <div className="deck-meter" aria-hidden="true">
                  <span className="meter-fill fill-a" />
                  <span className="meter-fill fill-b" />
                  <span className="meter-fill fill-c" />
                </div>
                <div className="deck-stage-list">
                  {pipeline.map((stage, index) => (
                    <div className="deck-stage-row" key={stage.label}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{stage.title}</strong>
                      <CheckCircle2 size={14} />
                    </div>
                  ))}
                </div>
              </article>

              <article className="deck-approval-gate">
                <ShieldCheck size={19} />
                <span>승인 단계</span>
                <strong>렌더와 업로드는 검토 후 실행</strong>
              </article>

              <article className="deck-channel-rack">
                <KeyRound size={18} />
                <span>채널 권한</span>
                <strong>채널별 refresh token 분리</strong>
              </article>

              <article className="deck-queue-panel">
                <div className="queue-signal">
                  <FileSearch size={16} />
                  <span>소스 검토</span>
                </div>
                <div className="queue-signal">
                  <Clapperboard size={16} />
                  <span>장면 초안</span>
                </div>
                <div className="queue-signal">
                  <Gauge size={16} />
                  <span>비용 확인</span>
                </div>
              </article>
            </div>
          </div>
        </div>

        <div className="hero-copy">
          <p className="hero-kicker">검수 후 진행하는 제작 작업장</p>
          <h1 id="home-title">YouTube Idea Factory</h1>
          <p>
            여러 브랜드 채널의 리서치, 분석, 대본, 스토리보드, 생성, 영상 조립, 배포를 하나의
            제작 기록으로 묶습니다. 비용과 업로드 위험이 있는 단계는 사람이 승인할 때까지 멈춥니다.
          </p>
          <div className="hero-command-strip" aria-label="핵심 운영 기준">
            <span>
              <ShieldCheck size={15} />
              승인 단계 우선
            </span>
            <span>
              <KeyRound size={15} />
              채널 OAuth 분리
            </span>
            <span>
              <Layers3 size={15} />
              제작 패키지 보존
            </span>
          </div>
          <div className="hero-actions">
            <Link className="text-button primary" href={primaryHref}>
              <span>작업장 열기</span>
              <i aria-hidden="true">
                <ArrowRight size={15} />
              </i>
            </Link>
            <Link className="home-text-link" href="/admin/channels">
              채널 권한부터 정리
            </Link>
          </div>
        </div>
      </section>

      <section className="home-proof-strip" aria-label="운영 기준">
        <div>
          <BadgeCheck size={17} />
          <span>source links preserved</span>
        </div>
        <div>
          <Gauge size={17} />
          <span>생성 전 비용 승인</span>
        </div>
        <div>
          <Layers3 size={17} />
          <span>제작 기록별 결과 보관</span>
        </div>
      </section>

      <section className="marketing-section">
        <div className="section-heading">
          <h2>자동 생성기가 아니라, 승인 가능한 제작 관제실입니다.</h2>
          <p>
            스킬은 판단을 돕고, 스크립트와 연결 도구는 반복 작업을 고정합니다. 결과물은 편집 가능한
            제작 패키지로 남아 누가 무엇을 승인했는지 따라갈 수 있습니다.
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
              소스, 주장, 대본, 스토리보드, 필요한 미디어, 영상 조립 계획, 업로드 준비 목록이 하나의
              제작 기록에 묶입니다. 운영자는 어느 단계가 막혔는지 바로 확인할 수 있습니다.
            </p>
          </article>
        </div>
      </section>

      <section className="command-tile-strip" aria-label="운영 하네스">
        {commandTiles.map((item) => (
          <article key={item.title}>
            <span>{item.label}</span>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="pipeline-strip" aria-label="콘텐츠 제작 순서">
        {pipeline.map((item, index) => (
          <article className="pipeline-strip-item" key={item.label}>
            <span>
              {String(index + 1).padStart(2, "0")} / {item.label}
            </span>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="marketing-cta">
        <div>
          <h2>다음 실행부터 브랜드 채널별로 분리하세요.</h2>
          <p>
            채널 OAuth, API 설정, 승인 절차를 먼저 정리하면 생성 비용과 업로드 위험을
            통제할 수 있습니다.
          </p>
        </div>
        <Link className="text-button primary" href="/admin/channels">
          <span>채널 관리 시작</span>
          <i aria-hidden="true">
            <ArrowRight size={15} />
          </i>
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
