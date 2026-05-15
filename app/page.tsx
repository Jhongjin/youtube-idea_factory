import {
  ArrowRight,
  BadgeCheck,
  Clapperboard,
  FileSearch,
  Fingerprint,
  Gauge,
  Layers3,
  RadioTower,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const pipeline = [
  "카테고리 선택",
  "상위 영상 리서치",
  "구조 분석",
  "팩트체크",
  "대본 설계",
  "스토리보드",
  "미디어 생성",
  "검수 후 배포",
];

const featureCards = [
  {
    body: "유튜브 파인더, 영상 분석, 대본 설계 스킬이 같은 제작 패키지를 업데이트합니다.",
    icon: FileSearch,
    title: "한 실행 안에 쌓이는 리서치",
  },
  {
    body: "팩트, 승인, 렌더, 업로드 게이트를 분리해 비용과 리스크가 있는 작업을 멈춰 세웁니다.",
    icon: Fingerprint,
    title: "사람 승인 전에는 돈을 쓰지 않음",
  },
  {
    body: "브랜드 채널별 OAuth, 제공자 API, 워커 큐 상태를 운영 화면에서 확인합니다.",
    icon: RadioTower,
    title: "10개 채널 운영을 위한 권한 지도",
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

  return (
    <main className="marketing-page" id="main-content">
      <nav className="marketing-nav" aria-label="주요 메뉴">
        <Link className="marketing-brand" href="/">
          <span className="marketing-brand-mark">
            <Sparkles size={18} />
          </span>
          <span>YouTube Idea Factory</span>
        </Link>
        <div className="marketing-nav-links">
          <Link href="/dashboard">작업장</Link>
          <Link href="/admin/channels">채널 관리</Link>
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

      <section className="marketing-hero">
        <div className="hero-copy">
          <p className="hero-kicker">Research to render, gated by review</p>
          <h1>브랜드 채널을 위한 영상 제작 오케스트레이션</h1>
          <p>
            주제 입력부터 상위 영상 분석, 팩트체크, 대본, 스토리보드, 생성 프롬프트, 렌더와
            유튜브 배포 준비까지 한 실행 안에서 추적합니다.
          </p>
          <div className="hero-actions">
            <Link className="text-button primary" href={user ? "/dashboard" : "/login"}>
              작업장 열기
              <ArrowRight size={15} />
            </Link>
            <Link className="text-button" href="/admin/channels">
              채널 관리
            </Link>
          </div>
        </div>
        <div className="digital-art-panel" aria-label="제작 자동화 흐름 시각화">
          <div className="orbital-board">
            <div className="orbit-ring one" />
            <div className="orbit-ring two" />
            <div className="signal-column left">
              <span />
              <span />
              <span />
            </div>
            <div className="signal-column right">
              <span />
              <span />
              <span />
            </div>
            <div className="core-node">
              <Layers3 size={28} />
              <strong>Factory Core</strong>
              <small>review gated</small>
            </div>
            <div className="floating-node node-a">
              <FileSearch size={16} />
              리서치
            </div>
            <div className="floating-node node-b">
              <Clapperboard size={16} />
              스토리
            </div>
            <div className="floating-node node-c">
              <Gauge size={16} />
              배포
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="section-heading">
          <h2>자동화보다 먼저 필요한 운영 질서</h2>
          <p>결정론적 스크립트와 창의적 AI 스킬을 나누고, 위험 단계는 승인 게이트로 고정합니다.</p>
        </div>
        <div className="feature-masonry">
          {featureCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <article className={`feature-tile tile-${index + 1}`} key={card.title}>
                <Icon size={22} />
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            );
          })}
          <article className="feature-tile wide">
            <div>
              <BadgeCheck size={22} />
              <h3>검수 가능한 산출물</h3>
            </div>
            <p>
              모든 실행은 소스, 클레임, 대본 구성, 씬, 프롬프트, 배포 패키지와 QA 로그를 남깁니다.
              채널별 성과 메모리까지 연결해 다음 실행의 판단 재료로 씁니다.
            </p>
          </article>
        </div>
      </section>

      <section className="pipeline-strip" aria-label="콘텐츠 제작 순서">
        {pipeline.map((item, index) => (
          <div className="pipeline-strip-item" key={item}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item}</strong>
          </div>
        ))}
      </section>

      <section className="marketing-cta">
        <div>
          <h2>먼저 채널을 등록하고, 다음 실행부터 브랜드별로 분리하세요.</h2>
          <p>업로드 OAuth와 Analytics OAuth를 채널별로 관리하면 10개 브랜드도 같은 흐름으로 운영할 수 있습니다.</p>
        </div>
        <Link className="text-button primary" href="/admin/channels">
          채널 관리 시작
          <ArrowRight size={15} />
        </Link>
      </section>
    </main>
  );
}
