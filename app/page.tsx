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
    title: "승인 후 영상 합성과 업로드",
    detail: "비용과 업로드가 연결되는 단계는 유저 승인 이후 진행합니다.",
  },
];

const proofItems = [
  {
    icon: ShieldCheck,
    title: "완전 수동 승인 시스템",
    body: "영상 합성과 유튜브 업로드 등 비용이 발생하는 중요한 단계는 사용자의 승인 없이 절대 독단적으로 실행되지 않습니다.",
    visual: "approval",
  },
  {
    icon: RadioTower,
    title: "한 화면에서 끝내는 다중 채널",
    body: "채널별 연동 계정(OAuth), 타겟 언어, AI 데이터를 완전히 분리하여 여러 채널을 하나의 대시보드에서 안전하게 독립 운영합니다.",
    visual: "channels",
  },
  {
    icon: Brain,
    title: "성과를 학습하는 AI 기획",
    body: "업로드된 영상의 조회수, 피드백, A/B 테스트 데이터를 다음 콘텐츠 기획의 정교한 타겟팅 재료로 축적합니다.",
    visual: "learning",
  },
];

const commandTiles = [
  {
    label: "gate",
    title: "승인 전 비용 차단",
    detail: "생성, 영상 합성, 업로드는 유저가 승인할 때만 다음 작업으로 넘어갑니다.",
  },
  {
    label: "channel",
    title: "브랜드별 권한 분리",
    detail: "업로드 토큰과 Analytics 토큰을 채널 단위로 보관합니다.",
  },
  {
    label: "memory",
    title: "성과를 학습하는 기획 데이터",
    detail: "성과 스냅샷과 채널 메모리가 다음 콘텐츠 판단의 근거가 됩니다.",
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
          <Link href="/dashboard">대시보드</Link>
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
                <strong>영상 합성과 업로드는 승인 후 실행</strong>
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
          <p className="hero-kicker">유저 승인 후 진행되는 제작 대시보드</p>
          <h1 id="home-title">YouTube Idea Factory</h1>
          <p>
            상위 조회수 영상 후보를 리서치하고, 분석, 대본, 스토리보드, 생성 요청서, 영상 합성,
            업로드 준비까지 하나의 제작 패키지로 구성합니다. 비용이 발생하거나 업로드와 연결되는
            단계는 유저의 사용 승인 이후에만 진행됩니다.
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
              <span>대시보드 열기</span>
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
          <h2 aria-label="AI가 빌드하고 당신이 컨펌하는, 가장 완벽한 유튜브 워크플로우">
            <span>
              <span className="highlight-word">AI</span>가 빌드하고 <span className="highlight-word">당신</span>이 컨펌하는,
            </span>
            <span>가장 완벽한 유튜브 워크플로우</span>
          </h2>
          <div className="section-heading-copy">
            <p>
              매주 <strong>상위 트렌드 영상</strong>을 분석해 대본 추출부터 스토리보드 작성까지 AI가 먼저
              준비합니다. 단순 반복 작업은 시스템에 맡기고, 당신은 <strong>최종 컨펌</strong>과{" "}
              <strong>채널 성장</strong>에 집중하세요.
            </p>
            <div className="section-cta-row">
              <Link className="text-button primary" href={primaryHref}>
                <span>무료로 시작하기</span>
                <i aria-hidden="true">
                  <ArrowRight size={15} />
                </i>
              </Link>
              <Link className="home-text-link" href="#content-workflow">
                서비스 가이드 보기
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
        <div className="feature-masonry">
          {proofItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <article className={`feature-tile tile-${index + 1}`} key={item.title}>
                <div className={`feature-visual ${item.visual}`} aria-hidden="true">
                  <Icon size={22} />
                  {item.visual === "approval" ? (
                    <span className="approval-lock-signal">
                      <i />
                      <i />
                    </span>
                  ) : null}
                  {item.visual === "channels" ? (
                    <span className="channel-node-map">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : null}
                  {item.visual === "learning" ? (
                    <span className="learning-meter">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : null}
                </div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            );
          })}
          <article className="feature-tile wide">
            <div>
              <ListChecks size={22} />
              <h3>프로젝트별 통합 제작 히스토리</h3>
            </div>
            <div className="wide-feature-copy">
              <p>
                레퍼런스 소스, 대본, 스토리보드, 미디어 에셋부터 업로드 대기 목록까지 전 과정이 하나의
                프로젝트 패키지로 묶입니다. 워크플로우 중 어느 단계에서 병목이나 오류가 생겼는지
                직관적으로 추적하고 수정할 수 있습니다.
              </p>
              <div className="history-timeline" aria-label="제작 패키지 흐름">
                {["소스", "대본", "스토리보드", "영상"].map((step, index) => (
                  <span key={step}>
                    <strong>{String(index + 1).padStart(2, "0")}</strong>
                    {step}
                  </span>
                ))}
              </div>
            </div>
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

      <section className="pipeline-strip" id="content-workflow" aria-label="콘텐츠 제작 순서">
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
