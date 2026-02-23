'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import type { AIAgentResponse } from '@/lib/aiAgent'
import {
  Download, Clock, Eye, Heart, Share2, MessageCircle,
  ChevronDown, X, Play, Scissors, Hash, TrendingUp,
  Activity, Film, CheckCircle, AlertCircle, ChevronRight,
  ToggleLeft, ToggleRight, ArrowLeft, SlidersHorizontal,
  RefreshCw, ExternalLink, BarChart2, Sparkles, Zap,
  Youtube, Instagram
} from 'lucide-react'

// ── TikTok SVG Icon (not available in lucide) ────────
function TikTokIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.81a8.23 8.23 0 004.76 1.52V6.88a4.85 4.85 0 01-1-.19z" />
    </svg>
  )
}

// ── Types ──────────────────────────────────────────────

interface TrendingVideo {
  video_id: string
  title: string
  creator_username: string
  creator_display_name: string
  thumbnail_url: string
  video_url: string
  view_count: number
  like_count: number
  share_count: number
  comment_count: number
  engagement_score: number
  hashtags: string[]
  posted_date: string
  duration_seconds: number
  trending_rank: number
  platform: string
}

interface TrendSummary {
  total_videos: number
  tiktok_count: number
  youtube_count: number
  instagram_count: number
  trending_themes: string[]
}

interface GeneratedClip {
  clip_id: string
  source_video_id: string
  clip_title: string
  start_time: string
  end_time: string
  duration_seconds: number
  aspect_ratio: string
  target_platform: string
  captions_included: boolean
  clip_url: string
  thumbnail_url: string
  highlight_type: string
  confidence_score: number
}

interface ArtifactFile {
  file_url: string
  name?: string
  format_type?: string
}

interface ClipSession {
  id: string
  sourceVideoTitle: string
  clips: GeneratedClip[]
  artifactFiles: ArtifactFile[]
  totalClips: number
  processingSummary: string
  generatedAt: string
}

// ── Utility Functions ──────────────────────────────────

function safeParseResult(result: any): any {
  if (!result) return {}
  if (typeof result === 'string') {
    try { return JSON.parse(result) } catch { return { text: result } }
  }
  const parsed = { ...result }
  for (const key of Object.keys(parsed)) {
    if (typeof parsed[key] === 'string') {
      try { parsed[key] = JSON.parse(parsed[key]) } catch {}
    }
  }
  return parsed
}

function formatNumber(num: number | undefined | null): string {
  if (num == null || isNaN(num)) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

function formatDuration(seconds: number | undefined | null): string {
  if (seconds == null || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getPlatformNormalized(platform: string | undefined): string {
  if (!platform) return 'unknown'
  const p = platform.toLowerCase().trim()
  if (p.includes('tiktok') || p.includes('tik tok')) return 'tiktok'
  if (p.includes('youtube') || p.includes('yt')) return 'youtube'
  if (p.includes('instagram') || p.includes('ig') || p.includes('insta')) return 'instagram'
  return p
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1 text-[hsl(180,100%,70%)]">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1 text-[hsl(180,100%,70%)]">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2 text-[hsl(180,100%,70%)]">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm text-[hsl(180,50%,60%)]">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm text-[hsl(180,50%,60%)]">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm text-[hsl(180,50%,60%)]">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-[hsl(180,100%,70%)]">{part}</strong> : part
  )
}

// ── Sample Data ────────────────────────────────────────

const SAMPLE_VIDEOS: TrendingVideo[] = [
  {
    video_id: 'tt_001', title: 'POV: When the bass drops at 3am', creator_username: '@beatdropper', creator_display_name: 'BeatDropper',
    thumbnail_url: '', video_url: '', view_count: 12500000, like_count: 3200000, share_count: 890000, comment_count: 145000,
    engagement_score: 94.5, hashtags: ['#bass', '#edm', '#vibes', '#fyp'], posted_date: '2026-02-21', duration_seconds: 45, trending_rank: 1, platform: 'tiktok'
  },
  {
    video_id: 'yt_002', title: 'I Built a Robot That Cooks Dinner - Gone Wrong', creator_username: '@techcrafter', creator_display_name: 'TechCrafter',
    thumbnail_url: '', video_url: '', view_count: 8700000, like_count: 620000, share_count: 340000, comment_count: 89000,
    engagement_score: 88.2, hashtags: ['#robotics', '#diy', '#fail', '#cooking'], posted_date: '2026-02-20', duration_seconds: 720, trending_rank: 2, platform: 'youtube'
  },
  {
    video_id: 'ig_003', title: 'Sunset timelapse from my balcony in Tokyo', creator_username: '@tokyodreams', creator_display_name: 'Tokyo Dreams',
    thumbnail_url: '', video_url: '', view_count: 5400000, like_count: 1800000, share_count: 560000, comment_count: 67000,
    engagement_score: 91.1, hashtags: ['#tokyo', '#sunset', '#timelapse', '#japan'], posted_date: '2026-02-22', duration_seconds: 60, trending_rank: 3, platform: 'instagram'
  },
  {
    video_id: 'tt_004', title: 'This makeup hack changed everything', creator_username: '@glamqueen', creator_display_name: 'Glam Queen',
    thumbnail_url: '', video_url: '', view_count: 9800000, like_count: 2100000, share_count: 1200000, comment_count: 210000,
    engagement_score: 92.7, hashtags: ['#makeup', '#beauty', '#hack', '#grwm'], posted_date: '2026-02-21', duration_seconds: 32, trending_rank: 4, platform: 'tiktok'
  },
  {
    video_id: 'yt_005', title: '24 Hours Living as a Medieval Knight', creator_username: '@historynut', creator_display_name: 'History Nut',
    thumbnail_url: '', video_url: '', view_count: 6300000, like_count: 450000, share_count: 280000, comment_count: 56000,
    engagement_score: 85.4, hashtags: ['#medieval', '#challenge', '#history', '#knight'], posted_date: '2026-02-19', duration_seconds: 1200, trending_rank: 5, platform: 'youtube'
  },
  {
    video_id: 'ig_006', title: 'Street food tour in Bangkok - must try!', creator_username: '@foodwanderer', creator_display_name: 'Food Wanderer',
    thumbnail_url: '', video_url: '', view_count: 4200000, like_count: 980000, share_count: 410000, comment_count: 73000,
    engagement_score: 87.9, hashtags: ['#streetfood', '#bangkok', '#foodie', '#travel'], posted_date: '2026-02-22', duration_seconds: 90, trending_rank: 6, platform: 'instagram'
  },
]

const SAMPLE_SUMMARY: TrendSummary = {
  total_videos: 6, tiktok_count: 2, youtube_count: 2, instagram_count: 2,
  trending_themes: ['Music & Bass', 'DIY & Tech', 'Travel', 'Beauty', 'Food', 'History']
}

const SAMPLE_CLIPS: GeneratedClip[] = [
  { clip_id: 'cl_001', source_video_id: 'yt_002', clip_title: 'Robot Arm Malfunction Moment', start_time: '02:15', end_time: '02:45', duration_seconds: 30, aspect_ratio: '9:16', target_platform: 'TikTok', captions_included: true, clip_url: '', thumbnail_url: '', highlight_type: 'Hook', confidence_score: 0.95 },
  { clip_id: 'cl_002', source_video_id: 'yt_002', clip_title: 'The Big Reveal', start_time: '08:30', end_time: '09:10', duration_seconds: 40, aspect_ratio: '9:16', target_platform: 'Instagram Reels', captions_included: true, clip_url: '', thumbnail_url: '', highlight_type: 'Punchline', confidence_score: 0.88 },
  { clip_id: 'cl_003', source_video_id: 'yt_002', clip_title: 'Epic Kitchen Fail Compilation', start_time: '05:00', end_time: '06:00', duration_seconds: 60, aspect_ratio: '1:1', target_platform: 'YouTube Shorts', captions_included: true, clip_url: '', thumbnail_url: '', highlight_type: 'Key Scene', confidence_score: 0.82 },
]

// ── Agent Config ───────────────────────────────────────

const AGENT_TREND_DISCOVERY = '699bae65ac313b176acdea2e'
const AGENT_CLIP_GENERATOR = '699bae76ba7d62583e0a4a8f'

const AGENTS_INFO = [
  { id: AGENT_TREND_DISCOVERY, name: 'Trend Discovery Manager', purpose: 'Coordinates TikTok, YouTube, Instagram sub-agents to discover trending content' },
  { id: AGENT_CLIP_GENERATOR, name: 'Clip Generator Agent', purpose: 'Analyzes videos and generates optimized clips with captions for target platforms' },
]

// ── Sub Components ─────────────────────────────────────

function PlatformIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  const p = getPlatformNormalized(platform)
  if (p === 'tiktok') return <TikTokIcon size={size} />
  if (p === 'youtube') return <Youtube size={size} />
  if (p === 'instagram') return <Instagram size={size} />
  return <Play size={size} />
}

function PlatformBadge({ platform }: { platform: string }) {
  const p = getPlatformNormalized(platform)
  const styles: Record<string, string> = {
    tiktok: 'bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)]',
    youtube: 'bg-[hsl(0,100%,50%)] text-white',
    instagram: 'bg-[hsl(300,80%,50%)] text-white',
  }
  const labels: Record<string, string> = { tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${styles[p] || 'bg-[hsl(260,20%,25%)] text-[hsl(180,50%,60%)]'}`}>
      <PlatformIcon platform={platform} size={12} />
      {labels[p] || platform}
    </span>
  )
}

function EngagementBar({ score }: { score: number | undefined | null }) {
  const s = score ?? 0
  const pct = Math.min(Math.max(s, 0), 100)
  return (
    <div className="w-full h-1.5 rounded-full bg-[hsl(260,20%,15%)] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, hsl(180,100%,50%), hsl(300,80%,50%))',
        }}
      />
    </div>
  )
}

function ConfidenceBadge({ score }: { score: number | undefined | null }) {
  const s = score ?? 0
  const pct = Math.round(s * 100)
  let color = 'text-[hsl(0,100%,55%)]'
  if (pct >= 80) color = 'text-[hsl(180,100%,50%)]'
  else if (pct >= 60) color = 'text-[hsl(60,100%,50%)]'
  return <span className={`font-bold text-sm ${color}`}>{pct}%</span>
}

function SkeletonCard() {
  return (
    <div className="rounded bg-[hsl(260,25%,9%)]/80 backdrop-blur-[12px] border border-white/10 overflow-hidden animate-pulse">
      <div className="aspect-video bg-[hsl(260,20%,15%)]" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-[hsl(260,20%,15%)] rounded w-3/4" />
        <div className="h-3 bg-[hsl(260,20%,15%)] rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-3 bg-[hsl(260,20%,15%)] rounded w-16" />
          <div className="h-3 bg-[hsl(260,20%,15%)] rounded w-16" />
        </div>
      </div>
    </div>
  )
}

function VideoCard({ video, onClick }: { video: TrendingVideo; onClick: () => void }) {
  const p = getPlatformNormalized(video?.platform)
  const gradients: Record<string, string> = {
    tiktok: 'from-[hsl(180,100%,20%)] via-[hsl(200,80%,15%)] to-[hsl(260,30%,10%)]',
    youtube: 'from-[hsl(0,80%,25%)] via-[hsl(350,60%,15%)] to-[hsl(260,30%,10%)]',
    instagram: 'from-[hsl(300,60%,25%)] via-[hsl(320,50%,15%)] to-[hsl(260,30%,10%)]',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded bg-[hsl(260,25%,9%)]/80 backdrop-blur-[12px] border border-white/10 overflow-hidden transition-all duration-300 hover:border-[hsl(180,100%,50%)]/50 hover:shadow-[0_0_20px_rgba(0,255,255,0.15)] hover:scale-[1.02] group w-full"
    >
      <div className={`aspect-video bg-gradient-to-br ${gradients[p] || gradients.tiktok} relative flex items-center justify-center`}>
        <PlatformIcon platform={video?.platform} size={40} />
        <div className="absolute top-2 right-2">
          <PlatformBadge platform={video?.platform} />
        </div>
        <div className="absolute bottom-2 right-2 bg-black/70 text-[hsl(180,100%,70%)] px-2 py-0.5 rounded text-xs font-mono">
          {formatDuration(video?.duration_seconds)}
        </div>
        {(video?.trending_rank ?? 0) > 0 && (
          <div className="absolute top-2 left-2 bg-[hsl(60,100%,50%)] text-[hsl(260,30%,6%)] w-7 h-7 rounded flex items-center justify-center text-xs font-black">
            #{video.trending_rank}
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <h3 className="font-bold text-sm text-[hsl(180,100%,70%)] leading-tight line-clamp-2 group-hover:text-[hsl(180,100%,80%)] transition-colors">
          {video?.title ?? 'Untitled'}
        </h3>
        <p className="text-xs text-[hsl(180,50%,45%)]">
          {video?.creator_display_name || video?.creator_username || 'Unknown Creator'}
        </p>
        <div className="flex items-center gap-3 text-xs text-[hsl(180,50%,45%)]">
          <span className="inline-flex items-center gap-1"><Eye size={12} /> {formatNumber(video?.view_count)}</span>
          <span className="inline-flex items-center gap-1"><Heart size={12} /> {formatNumber(video?.like_count)}</span>
          <span className="inline-flex items-center gap-1"><Share2 size={12} /> {formatNumber(video?.share_count)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[hsl(180,50%,45%)] uppercase tracking-wider">Engagement</span>
          <div className="flex-1"><EngagementBar score={video?.engagement_score} /></div>
          <span className="text-[10px] font-bold text-[hsl(180,100%,50%)]">{(video?.engagement_score ?? 0).toFixed(1)}</span>
        </div>
      </div>
    </button>
  )
}

function ClipCard({ clip, artifactFile, index }: { clip: GeneratedClip; artifactFile?: ArtifactFile; index: number }) {
  const highlightColors: Record<string, string> = {
    hook: 'bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)]',
    punchline: 'bg-[hsl(300,80%,50%)] text-white',
    'key scene': 'bg-[hsl(60,100%,50%)] text-[hsl(260,30%,6%)]',
    'viral moment': 'bg-[hsl(0,100%,55%)] text-white',
  }
  const hType = (clip?.highlight_type ?? '').toLowerCase()
  return (
    <div className="rounded bg-[hsl(260,25%,9%)]/80 backdrop-blur-[12px] border border-white/10 overflow-hidden hover:border-[hsl(300,80%,50%)]/40 transition-all duration-300">
      <div className="aspect-video bg-gradient-to-br from-[hsl(300,60%,20%)] via-[hsl(260,40%,15%)] to-[hsl(240,30%,10%)] relative flex items-center justify-center">
        <Scissors size={32} className="text-[hsl(300,80%,50%)]" />
        <div className="absolute top-2 left-2">
          {clip?.highlight_type && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${highlightColors[hType] || 'bg-[hsl(260,20%,25%)] text-[hsl(180,50%,60%)]'}`}>
              {clip.highlight_type}
            </span>
          )}
        </div>
        <div className="absolute bottom-2 right-2 bg-black/70 text-[hsl(300,80%,60%)] px-2 py-0.5 rounded text-xs font-mono">
          {formatDuration(clip?.duration_seconds)}
        </div>
        <div className="absolute top-2 right-2 bg-black/50 text-white px-1.5 py-0.5 rounded text-[10px] font-mono">
          {clip?.aspect_ratio ?? ''}
        </div>
      </div>
      <div className="p-3 space-y-2">
        <h4 className="font-bold text-sm text-[hsl(180,100%,70%)] leading-tight line-clamp-2">
          {clip?.clip_title ?? `Clip ${index + 1}`}
        </h4>
        <div className="flex items-center gap-2 flex-wrap">
          {clip?.target_platform && <PlatformBadge platform={clip.target_platform} />}
          {clip?.captions_included && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[hsl(260,20%,15%)] text-[hsl(180,50%,60%)] text-[10px] font-bold">
              CC
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-[hsl(180,50%,45%)]">
          <span>{clip?.start_time ?? '0:00'} - {clip?.end_time ?? '0:00'}</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider">Confidence</span>
            <ConfidenceBadge score={clip?.confidence_score} />
          </div>
        </div>
        {artifactFile?.file_url && (
          <a
            href={artifactFile.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full mt-2 py-2 rounded bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)] font-bold text-xs hover:shadow-[0_0_20px_rgba(0,255,255,0.5)] transition-all"
          >
            <Download size={14} /> Download Clip
          </a>
        )}
      </div>
    </div>
  )
}

function AgentStatusPanel({ agents, activeAgentId }: { agents: typeof AGENTS_INFO; activeAgentId: string | null }) {
  return (
    <div className="rounded bg-[hsl(260,25%,9%)]/80 backdrop-blur-[12px] border border-white/10 p-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[hsl(180,50%,45%)] mb-3 flex items-center gap-2">
        <Activity size={14} /> Agent Status
      </h3>
      <div className="space-y-2">
        {agents.map((agent) => (
          <div key={agent.id} className={`flex items-center gap-3 p-2 rounded text-xs transition-all ${activeAgentId === agent.id ? 'bg-[hsl(180,100%,50%)]/10 border border-[hsl(180,100%,50%)]/30' : 'border border-transparent'}`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeAgentId === agent.id ? 'bg-[hsl(180,100%,50%)] animate-pulse' : 'bg-[hsl(260,20%,25%)]'}`} />
            <div className="min-w-0">
              <div className="font-bold text-[hsl(180,100%,70%)] truncate">{agent.name}</div>
              <div className="text-[hsl(180,50%,45%)] text-[10px] truncate">{agent.purpose}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ErrorBoundary ──────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(260, 30%, 6%)' }}>
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2 text-[hsl(180,100%,70%)]">Something went wrong</h2>
            <p className="text-[hsl(180,50%,45%)] mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)] rounded text-sm font-bold hover:shadow-[0_0_20px_rgba(0,255,255,0.5)] transition-all">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── CSS Keyframes ─────────────────────────────────────

const slideInKeyframes = `
@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 5px rgba(0,255,255,0.2); }
  50% { box-shadow: 0 0 15px rgba(0,255,255,0.4); }
}
`

// ── Main Page ──────────────────────────────────────────

export default function Page() {
  // ── State ─────────────────────────
  const [activeTab, setActiveTab] = useState<'discover' | 'history'>('discover')
  const [platformFilter, setPlatformFilter] = useState<'all' | 'tiktok' | 'youtube' | 'instagram'>('all')
  const [sortBy, setSortBy] = useState<'trending' | 'views' | 'shares'>('trending')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [trendingVideos, setTrendingVideos] = useState<TrendingVideo[]>([])
  const [trendSummary, setTrendSummary] = useState<TrendSummary | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string>('')
  const [selectedVideo, setSelectedVideo] = useState<TrendingVideo | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [clips, setClips] = useState<GeneratedClip[]>([])
  const [artifactFiles, setArtifactFiles] = useState<ArtifactFile[]>([])
  const [clipHistory, setClipHistory] = useState<ClipSession[]>([])
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null)
  const [isLoadingTrends, setIsLoadingTrends] = useState(false)
  const [isGeneratingClips, setIsGeneratingClips] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['tiktok', 'youtube_shorts', 'instagram_reels'])
  const [includeCaptions, setIncludeCaptions] = useState(true)
  const [numClips, setNumClips] = useState(5)
  const [showClipResults, setShowClipResults] = useState(false)
  const [clipSourceTitle, setClipSourceTitle] = useState('')
  const [clipProcessingSummary, setClipProcessingSummary] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [sampleDataOn, setSampleDataOn] = useState(false)

  const sortDropdownRef = useRef<HTMLDivElement>(null)

  // Close sort dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Sample Data Toggle ────────────
  useEffect(() => {
    if (sampleDataOn) {
      setTrendingVideos(SAMPLE_VIDEOS)
      setTrendSummary(SAMPLE_SUMMARY)
      setFetchedAt('2026-02-23T12:00:00Z')
      setClipHistory((prev) => {
        if (prev.length === 0) {
          return [{
            id: 'sample_session_1',
            sourceVideoTitle: 'I Built a Robot That Cooks Dinner - Gone Wrong',
            clips: SAMPLE_CLIPS,
            artifactFiles: [],
            totalClips: 3,
            processingSummary: 'Successfully generated 3 clips targeting TikTok, Instagram Reels, and YouTube Shorts with auto-generated captions.',
            generatedAt: '2026-02-23T11:30:00Z',
          }]
        }
        return prev
      })
    } else {
      setTrendingVideos((prev) => prev === SAMPLE_VIDEOS ? [] : prev)
      setTrendSummary((prev) => prev === SAMPLE_SUMMARY ? null : prev)
      setFetchedAt((prev) => prev === '2026-02-23T12:00:00Z' ? '' : prev)
    }
  }, [sampleDataOn])

  // ── Discover Trends ───────────────
  const handleDiscoverTrends = useCallback(async () => {
    setIsLoadingTrends(true)
    setErrorMessage('')
    setSuccessMessage('')
    setActiveAgentId(AGENT_TREND_DISCOVERY)
    try {
      const result: AIAgentResponse = await callAIAgent(
        'Find the top trending videos across TikTok, YouTube, and Instagram right now. Return comprehensive data for each trending video.',
        AGENT_TREND_DISCOVERY
      )
      setActiveAgentId(null)
      if (result?.success) {
        const parsed = safeParseResult(result?.response?.result)
        const videos = Array.isArray(parsed?.trending_videos) ? parsed.trending_videos : []
        setTrendingVideos(videos)
        const summary = parsed?.summary
        if (summary && typeof summary === 'object') {
          setTrendSummary(summary as TrendSummary)
        }
        setFetchedAt(parsed?.fetched_at ?? '')
        if (videos.length > 0) {
          setSuccessMessage(`Found ${videos.length} trending videos across platforms`)
        } else {
          setErrorMessage('No trending videos found. Try again in a moment.')
        }
      } else {
        setErrorMessage(result?.error ?? 'Failed to fetch trending videos. Please try again.')
      }
    } catch (err: any) {
      setActiveAgentId(null)
      setErrorMessage('Network error. Please check your connection and try again.')
    }
    setIsLoadingTrends(false)
  }, [])

  // ── Generate Clips ────────────────
  const handleGenerateClips = useCallback(async () => {
    if (!selectedVideo) return
    setIsGeneratingClips(true)
    setShowClipResults(false)
    setClips([])
    setArtifactFiles([])
    setErrorMessage('')
    setActiveAgentId(AGENT_CLIP_GENERATOR)

    const platformNames = selectedPlatforms.map((p: string) => {
      if (p === 'tiktok') return 'TikTok'
      if (p === 'youtube_shorts') return 'YouTube Shorts'
      if (p === 'instagram_reels') return 'Instagram Reels'
      return p
    })

    try {
      const result: AIAgentResponse = await callAIAgent(
        `Analyze this video and generate optimized clips: Title: ${selectedVideo.title}, Video ID: ${selectedVideo.video_id}, Platform: ${selectedVideo.platform}, Duration: ${selectedVideo.duration_seconds}s. Target platforms: ${platformNames.join(', ')}. Generate ${numClips} clip variations${includeCaptions ? ' with captions' : ' without captions'}.`,
        AGENT_CLIP_GENERATOR
      )
      setActiveAgentId(null)
      if (result?.success) {
        const parsed = safeParseResult(result?.response?.result)
        const generatedClips = Array.isArray(parsed?.clips) ? parsed.clips : []
        const files = Array.isArray(result?.module_outputs?.artifact_files) ? result.module_outputs!.artifact_files : []
        setClips(generatedClips)
        setArtifactFiles(files as ArtifactFile[])
        setClipSourceTitle(parsed?.source_video_title ?? selectedVideo.title)
        setClipProcessingSummary(parsed?.processing_summary ?? '')
        setShowClipResults(true)

        // Add to history
        const session: ClipSession = {
          id: `session_${Date.now()}`,
          sourceVideoTitle: parsed?.source_video_title ?? selectedVideo.title,
          clips: generatedClips,
          artifactFiles: files as ArtifactFile[],
          totalClips: parsed?.total_clips_generated ?? generatedClips.length,
          processingSummary: parsed?.processing_summary ?? '',
          generatedAt: new Date().toISOString(),
        }
        setClipHistory(prev => [session, ...prev])
        setSuccessMessage(`Generated ${generatedClips.length} clips successfully!`)
      } else {
        setErrorMessage(result?.error ?? 'Failed to generate clips. Please try again.')
      }
    } catch (err: any) {
      setActiveAgentId(null)
      setErrorMessage('Network error during clip generation. Please try again.')
    }
    setIsGeneratingClips(false)
  }, [selectedVideo, selectedPlatforms, numClips, includeCaptions])

  // ── Filter & Sort ─────────────────
  const filteredVideos = trendingVideos.filter((v: TrendingVideo) => {
    if (platformFilter === 'all') return true
    return getPlatformNormalized(v?.platform) === platformFilter
  })

  const sortedVideos = [...filteredVideos].sort((a: TrendingVideo, b: TrendingVideo) => {
    if (sortBy === 'views') return (b?.view_count ?? 0) - (a?.view_count ?? 0)
    if (sortBy === 'shares') return (b?.share_count ?? 0) - (a?.share_count ?? 0)
    return (a?.trending_rank ?? 999) - (b?.trending_rank ?? 999)
  })

  // ── Toggle target platform ───────
  const toggleTargetPlatform = (p: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter((x: string) => x !== p) : [...prev, p]
    )
  }

  // ── Dismiss messages ──────────────
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(''), 5000)
      return () => clearTimeout(t)
    }
  }, [successMessage])

  useEffect(() => {
    if (errorMessage) {
      const t = setTimeout(() => setErrorMessage(''), 8000)
      return () => clearTimeout(t)
    }
  }, [errorMessage])

  const sortLabels: Record<string, string> = { trending: 'Trending', views: 'Most Viewed', shares: 'Most Shared' }

  return (
    <ErrorBoundary>
      <style>{slideInKeyframes}</style>
      <div className="min-h-screen font-sans tracking-wide leading-relaxed text-[hsl(180,100%,70%)] selection:bg-[hsl(180,100%,50%)]/30" style={{ background: 'linear-gradient(135deg, hsl(260,35%,8%) 0%, hsl(280,30%,10%) 50%, hsl(240,25%,8%) 100%)' }}>

        {/* ── Top Nav ──────────────────── */}
        <nav className="sticky top-0 z-50 backdrop-blur-[16px] border-b border-white/10" style={{ background: 'hsla(260,30%,6%,0.85)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Scissors size={22} className="text-[hsl(180,100%,50%)]" />
              <span className="text-lg font-black tracking-wider text-[hsl(180,100%,70%)]" style={{ textShadow: '0 0 10px rgba(0,255,255,0.5), 0 0 20px rgba(0,255,255,0.3)' }}>
                TrendClip
              </span>
            </div>

            {/* Nav tabs */}
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setActiveTab('discover')} className={`px-4 py-2 rounded text-sm font-bold transition-all ${activeTab === 'discover' ? 'bg-[hsl(180,100%,50%)]/15 text-[hsl(180,100%,70%)] shadow-[0_0_10px_rgba(0,255,255,0.2)]' : 'text-[hsl(180,50%,45%)] hover:text-[hsl(180,100%,70%)]'}`}>
                <span className="flex items-center gap-2"><TrendingUp size={16} /> Discover</span>
              </button>
              <button type="button" onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-[hsl(180,100%,50%)]/15 text-[hsl(180,100%,70%)] shadow-[0_0_10px_rgba(0,255,255,0.2)]' : 'text-[hsl(180,50%,45%)] hover:text-[hsl(180,100%,70%)]'}`}>
                <span className="flex items-center gap-2"><Clock size={16} /> Clip History</span>
              </button>
            </div>

            {/* Sample Data Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[hsl(180,50%,45%)]">Sample Data</span>
              <button type="button" onClick={() => setSampleDataOn(prev => !prev)} className="transition-colors">
                {sampleDataOn ? <ToggleRight size={24} className="text-[hsl(180,100%,50%)]" /> : <ToggleLeft size={24} className="text-[hsl(260,20%,30%)]" />}
              </button>
            </div>
          </div>
        </nav>

        {/* ── Messages ─────────────────── */}
        {errorMessage && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
            <div className="flex items-center gap-2 p-3 rounded bg-[hsl(0,100%,55%)]/15 border border-[hsl(0,100%,55%)]/30 text-[hsl(0,100%,70%)] text-sm">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span className="flex-1">{errorMessage}</span>
              <button type="button" onClick={() => setErrorMessage('')}><X size={14} /></button>
            </div>
          </div>
        )}
        {successMessage && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
            <div className="flex items-center gap-2 p-3 rounded bg-[hsl(180,100%,50%)]/15 border border-[hsl(180,100%,50%)]/30 text-[hsl(180,100%,70%)] text-sm">
              <CheckCircle size={16} className="flex-shrink-0" />
              <span className="flex-1">{successMessage}</span>
              <button type="button" onClick={() => setSuccessMessage('')}><X size={14} /></button>
            </div>
          </div>
        )}

        {/* ── DISCOVER TAB ─────────────── */}
        {activeTab === 'discover' && (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-wider" style={{ textShadow: '0 0 10px rgba(0,255,255,0.5), 0 0 20px rgba(0,255,255,0.3)' }}>
                  Discover Trending
                </h1>
                <p className="text-sm text-[hsl(180,50%,45%)] mt-1">
                  Scan TikTok, YouTube, and Instagram for viral content in real-time
                </p>
              </div>
              <button
                type="button"
                onClick={handleDiscoverTrends}
                disabled={isLoadingTrends}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)] font-bold text-sm hover:shadow-[0_0_30px_rgba(0,255,255,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isLoadingTrends ? (
                  <><RefreshCw size={16} className="animate-spin" /> Scanning Platforms...</>
                ) : (
                  <><Zap size={16} /> Find Trending</>
                )}
              </button>
            </div>

            {/* Summary bar */}
            {trendSummary && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[hsl(260,25%,9%)]/80 backdrop-blur-[12px] border border-white/10 text-xs">
                  <BarChart2 size={14} className="text-[hsl(180,100%,50%)]" />
                  <span className="font-bold">{trendSummary.total_videos ?? 0}</span>
                  <span className="text-[hsl(180,50%,45%)]">videos found</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[hsl(260,25%,9%)]/80 backdrop-blur-[12px] border border-white/10 text-xs">
                  <TikTokIcon size={12} />
                  <span className="font-bold">{trendSummary.tiktok_count ?? 0}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[hsl(260,25%,9%)]/80 backdrop-blur-[12px] border border-white/10 text-xs">
                  <Youtube size={12} className="text-[hsl(0,100%,50%)]" />
                  <span className="font-bold">{trendSummary.youtube_count ?? 0}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[hsl(260,25%,9%)]/80 backdrop-blur-[12px] border border-white/10 text-xs">
                  <Instagram size={12} className="text-[hsl(300,80%,50%)]" />
                  <span className="font-bold">{trendSummary.instagram_count ?? 0}</span>
                </div>
                {Array.isArray(trendSummary?.trending_themes) && trendSummary.trending_themes.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {trendSummary.trending_themes.slice(0, 5).map((theme: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-[hsl(300,80%,50%)]/15 border border-[hsl(300,80%,50%)]/30 text-[hsl(300,80%,60%)] text-[10px] font-bold">
                        {theme}
                      </span>
                    ))}
                  </div>
                )}
                {fetchedAt && (
                  <span className="text-[10px] text-[hsl(180,50%,35%)] ml-auto">
                    Updated: {fetchedAt}
                  </span>
                )}
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Platform filter tabs */}
              <div className="flex items-center gap-1 p-1 rounded bg-[hsl(260,25%,9%)]/80 backdrop-blur-[12px] border border-white/10">
                {([
                  { key: 'all' as const, label: 'All', icon: null },
                  { key: 'tiktok' as const, label: 'TikTok', icon: <TikTokIcon size={12} /> },
                  { key: 'youtube' as const, label: 'YouTube', icon: <Youtube size={12} /> },
                  { key: 'instagram' as const, label: 'Instagram', icon: <Instagram size={12} /> },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPlatformFilter(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${platformFilter === tab.key ? 'bg-[hsl(180,100%,50%)]/20 text-[hsl(180,100%,70%)] shadow-[0_0_8px_rgba(0,255,255,0.2)]' : 'text-[hsl(180,50%,45%)] hover:text-[hsl(180,100%,70%)]'}`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Sort dropdown */}
              <div className="relative ml-auto" ref={sortDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowSortDropdown(prev => !prev)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded bg-[hsl(260,25%,9%)]/80 backdrop-blur-[12px] border border-white/10 text-xs font-bold text-[hsl(180,50%,45%)] hover:text-[hsl(180,100%,70%)] transition-all"
                >
                  <SlidersHorizontal size={12} />
                  Sort: {sortLabels[sortBy]}
                  <ChevronDown size={12} className={`transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showSortDropdown && (
                  <div className="absolute right-0 mt-1 w-44 rounded bg-[hsl(260,25%,12%)] border border-white/10 shadow-xl z-40 overflow-hidden">
                    {(['trending', 'views', 'shares'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setSortBy(s); setShowSortDropdown(false) }}
                        className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${sortBy === s ? 'bg-[hsl(180,100%,50%)]/15 text-[hsl(180,100%,70%)]' : 'text-[hsl(180,50%,45%)] hover:bg-white/5 hover:text-[hsl(180,100%,70%)]'}`}
                      >
                        {sortLabels[s]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Loading skeletons */}
            {isLoadingTrends && (
              <div>
                <div className="flex items-center gap-2 mb-4 text-sm text-[hsl(180,100%,50%)]">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Scanning platforms for trending content</span>
                  <span className="inline-flex gap-0.5">
                    <span className="animate-pulse">.</span>
                    <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>.</span>
                    <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>.</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!isLoadingTrends && sortedVideos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-full bg-[hsl(260,25%,12%)] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,255,255,0.1)]">
                  <TrendingUp size={36} className="text-[hsl(180,100%,50%)]" />
                </div>
                <h2 className="text-xl font-bold text-[hsl(180,100%,70%)] mb-2" style={{ textShadow: '0 0 10px rgba(0,255,255,0.3)' }}>
                  Ready to Discover
                </h2>
                <p className="text-sm text-[hsl(180,50%,45%)] max-w-md">
                  Click &quot;Find Trending&quot; to scan TikTok, YouTube, and Instagram for the latest viral content. Our AI agents will analyze engagement patterns across all platforms.
                </p>
              </div>
            )}

            {/* Video grid */}
            {!isLoadingTrends && sortedVideos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedVideos.map((video: TrendingVideo) => (
                  <VideoCard
                    key={video?.video_id ?? Math.random().toString()}
                    video={video}
                    onClick={() => { setSelectedVideo(video); setShowDetailPanel(true); setShowClipResults(false); setClips([]); setArtifactFiles([]) }}
                  />
                ))}
              </div>
            )}

            {/* Agent Status */}
            <AgentStatusPanel agents={AGENTS_INFO} activeAgentId={activeAgentId} />
          </main>
        )}

        {/* ── HISTORY TAB ──────────────── */}
        {activeTab === 'history' && (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-wider" style={{ textShadow: '0 0 10px rgba(0,255,255,0.5), 0 0 20px rgba(0,255,255,0.3)' }}>
                Clip History
              </h1>
              <p className="text-sm text-[hsl(180,50%,45%)] mt-1">
                View past clip generation sessions and download your clips
              </p>
            </div>

            {clipHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-full bg-[hsl(260,25%,12%)] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,255,255,0.1)]">
                  <Clock size={36} className="text-[hsl(180,50%,45%)]" />
                </div>
                <h2 className="text-xl font-bold text-[hsl(180,100%,70%)] mb-2">No Clips Generated Yet</h2>
                <p className="text-sm text-[hsl(180,50%,45%)] max-w-md">
                  Go to the Discover tab, find trending videos, and generate clips. Your clip history will appear here.
                </p>
                <button type="button" onClick={() => setActiveTab('discover')} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)] font-bold text-sm hover:shadow-[0_0_20px_rgba(0,255,255,0.5)] transition-all">
                  <TrendingUp size={14} /> Go to Discover
                </button>
              </div>
            )}

            {clipHistory.length > 0 && (
              <div className="space-y-3">
                {clipHistory.map((session: ClipSession) => (
                  <div key={session.id} className="rounded bg-[hsl(260,25%,9%)]/80 backdrop-blur-[12px] border border-white/10 overflow-hidden transition-all hover:border-[hsl(180,100%,50%)]/30">
                    <button
                      type="button"
                      onClick={() => setExpandedHistory(prev => prev === session.id ? null : session.id)}
                      className="w-full text-left p-4 flex items-center gap-4"
                    >
                      <div className="w-10 h-10 rounded bg-[hsl(300,60%,20%)] flex items-center justify-center flex-shrink-0">
                        <Film size={20} className="text-[hsl(300,80%,60%)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-[hsl(180,100%,70%)] truncate">{session.sourceVideoTitle}</h3>
                        <div className="flex items-center gap-3 text-xs text-[hsl(180,50%,45%)] mt-0.5">
                          <span className="inline-flex items-center gap-1"><Scissors size={10} /> {session.totalClips} clips</span>
                          <span>{new Date(session.generatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className={`text-[hsl(180,50%,45%)] transition-transform flex-shrink-0 ${expandedHistory === session.id ? 'rotate-90' : ''}`} />
                    </button>

                    {expandedHistory === session.id && (
                      <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                        {session.processingSummary && (
                          <div className="text-xs text-[hsl(180,50%,45%)] p-2 rounded bg-[hsl(260,20%,12%)]">
                            {renderMarkdown(session.processingSummary)}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Array.isArray(session.clips) && session.clips.map((clip: GeneratedClip, idx: number) => (
                            <ClipCard
                              key={clip?.clip_id ?? idx}
                              clip={clip}
                              artifactFile={Array.isArray(session.artifactFiles) ? session.artifactFiles[idx] : undefined}
                              index={idx}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <AgentStatusPanel agents={AGENTS_INFO} activeAgentId={activeAgentId} />
          </main>
        )}

        {/* ── VIDEO DETAIL PANEL (Slide-over) ── */}
        {showDetailPanel && selectedVideo && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Overlay */}
            <button
              type="button"
              onClick={() => { setShowDetailPanel(false); setShowClipResults(false) }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-label="Close panel"
            />

            {/* Panel */}
            <div className="relative w-full max-w-lg border-l border-white/10 shadow-2xl overflow-y-auto" style={{ background: 'hsl(260, 30%, 7%)', animation: 'slideInRight 0.3s ease-out' }}>
              {/* Close button */}
              <button
                type="button"
                onClick={() => { setShowDetailPanel(false); setShowClipResults(false) }}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded flex items-center justify-center bg-white/10 hover:bg-white/20 text-[hsl(180,100%,70%)] transition-colors"
              >
                <X size={18} />
              </button>

              {!showClipResults ? (
                /* ── Video Detail View ── */
                <div className="space-y-5 pb-8">
                  {/* Video preview */}
                  <div className={`aspect-video bg-gradient-to-br ${getPlatformNormalized(selectedVideo.platform) === 'youtube' ? 'from-[hsl(0,80%,25%)] via-[hsl(350,60%,15%)] to-[hsl(260,30%,10%)]' : getPlatformNormalized(selectedVideo.platform) === 'instagram' ? 'from-[hsl(300,60%,25%)] via-[hsl(320,50%,15%)] to-[hsl(260,30%,10%)]' : 'from-[hsl(180,100%,20%)] via-[hsl(200,80%,15%)] to-[hsl(260,30%,10%)]'} relative flex items-center justify-center`}>
                    <PlatformIcon platform={selectedVideo.platform} size={64} />
                    <div className="absolute bottom-3 right-3 bg-black/70 text-[hsl(180,100%,70%)] px-3 py-1 rounded text-sm font-mono">
                      {formatDuration(selectedVideo.duration_seconds)}
                    </div>
                    <div className="absolute top-3 left-3">
                      <PlatformBadge platform={selectedVideo.platform} />
                    </div>
                    {selectedVideo.video_url && (
                      <a href={selectedVideo.video_url} target="_blank" rel="noopener noreferrer" className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 text-[hsl(180,100%,70%)] px-2 py-1 rounded text-xs hover:bg-black/80 transition-colors">
                        <ExternalLink size={12} /> Watch Original
                      </a>
                    )}
                  </div>

                  <div className="px-5 space-y-5">
                    {/* Title & Creator */}
                    <div>
                      <h2 className="text-lg font-bold text-[hsl(180,100%,70%)] leading-tight" style={{ textShadow: '0 0 8px rgba(0,255,255,0.3)' }}>
                        {selectedVideo.title ?? 'Untitled'}
                      </h2>
                      <p className="text-sm text-[hsl(180,50%,45%)] mt-1">
                        {selectedVideo.creator_display_name || selectedVideo.creator_username || 'Unknown'}
                        {selectedVideo.creator_username && <span className="ml-1 text-[hsl(180,50%,35%)]">@{selectedVideo.creator_username.replace('@', '')}</span>}
                      </p>
                      {selectedVideo.posted_date && (
                        <p className="text-xs text-[hsl(180,50%,35%)] mt-0.5">
                          Posted: {selectedVideo.posted_date}
                        </p>
                      )}
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded bg-[hsl(260,25%,12%)] border border-white/5 p-3 text-center">
                        <div className="text-lg font-black text-[hsl(180,100%,50%)]">{formatNumber(selectedVideo.view_count)}</div>
                        <div className="text-[10px] text-[hsl(180,50%,45%)] uppercase tracking-wider flex items-center justify-center gap-1"><Eye size={10} /> Views</div>
                      </div>
                      <div className="rounded bg-[hsl(260,25%,12%)] border border-white/5 p-3 text-center">
                        <div className="text-lg font-black text-[hsl(0,80%,60%)]">{formatNumber(selectedVideo.like_count)}</div>
                        <div className="text-[10px] text-[hsl(180,50%,45%)] uppercase tracking-wider flex items-center justify-center gap-1"><Heart size={10} /> Likes</div>
                      </div>
                      <div className="rounded bg-[hsl(260,25%,12%)] border border-white/5 p-3 text-center">
                        <div className="text-lg font-black text-[hsl(300,80%,60%)]">{formatNumber(selectedVideo.share_count)}</div>
                        <div className="text-[10px] text-[hsl(180,50%,45%)] uppercase tracking-wider flex items-center justify-center gap-1"><Share2 size={10} /> Shares</div>
                      </div>
                      <div className="rounded bg-[hsl(260,25%,12%)] border border-white/5 p-3 text-center">
                        <div className="text-lg font-black text-[hsl(60,100%,50%)]">{formatNumber(selectedVideo.comment_count)}</div>
                        <div className="text-[10px] text-[hsl(180,50%,45%)] uppercase tracking-wider flex items-center justify-center gap-1"><MessageCircle size={10} /> Comments</div>
                      </div>
                    </div>

                    {/* Engagement */}
                    <div className="rounded bg-[hsl(260,25%,12%)] border border-white/5 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[hsl(180,50%,45%)] uppercase tracking-wider">Engagement Score</span>
                        <span className="text-lg font-black text-[hsl(180,100%,50%)]">{(selectedVideo.engagement_score ?? 0).toFixed(1)}</span>
                      </div>
                      <EngagementBar score={selectedVideo.engagement_score} />
                    </div>

                    {/* Hashtags */}
                    {Array.isArray(selectedVideo?.hashtags) && selectedVideo.hashtags.length > 0 && (
                      <div>
                        <h3 className="text-xs text-[hsl(180,50%,45%)] uppercase tracking-wider mb-2 flex items-center gap-1"><Hash size={12} /> Hashtags</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedVideo.hashtags.map((tag: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-[hsl(180,100%,50%)]/10 border border-[hsl(180,100%,50%)]/20 text-[hsl(180,100%,60%)] text-xs">
                              {tag?.startsWith('#') ? tag : `#${tag}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Divider */}
                    <div className="border-t border-white/10" />

                    {/* Clip Generation Options */}
                    <div>
                      <h3 className="text-sm font-bold text-[hsl(180,100%,70%)] mb-3 flex items-center gap-2" style={{ textShadow: '0 0 8px rgba(0,255,255,0.3)' }}>
                        <Scissors size={16} /> Generate Clips
                      </h3>

                      {/* Target platforms */}
                      <div className="mb-4">
                        <label className="text-xs text-[hsl(180,50%,45%)] uppercase tracking-wider block mb-2">Target Platforms</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'tiktok', label: 'TikTok', icon: <TikTokIcon size={14} /> },
                            { key: 'youtube_shorts', label: 'YT Shorts', icon: <Youtube size={14} /> },
                            { key: 'instagram_reels', label: 'IG Reels', icon: <Instagram size={14} /> },
                          ].map(p => (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => toggleTargetPlatform(p.key)}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs font-bold transition-all border ${selectedPlatforms.includes(p.key) ? 'bg-[hsl(180,100%,50%)]/20 border-[hsl(180,100%,50%)]/50 text-[hsl(180,100%,70%)] shadow-[0_0_10px_rgba(0,255,255,0.15)]' : 'bg-[hsl(260,20%,12%)] border-white/10 text-[hsl(180,50%,45%)] hover:border-white/20'}`}
                            >
                              {p.icon} {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Captions toggle */}
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-xs text-[hsl(180,50%,45%)] uppercase tracking-wider">Include Captions</label>
                        <button type="button" onClick={() => setIncludeCaptions(prev => !prev)} className="transition-colors">
                          {includeCaptions ? <ToggleRight size={24} className="text-[hsl(180,100%,50%)]" /> : <ToggleLeft size={24} className="text-[hsl(260,20%,30%)]" />}
                        </button>
                      </div>

                      {/* Number of clips */}
                      <div className="mb-5">
                        <label className="text-xs text-[hsl(180,50%,45%)] uppercase tracking-wider block mb-2">Number of Clips</label>
                        <div className="flex gap-2">
                          {[3, 5, 7].map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setNumClips(n)}
                              className={`w-12 h-10 rounded text-sm font-bold transition-all border ${numClips === n ? 'bg-[hsl(180,100%,50%)]/20 border-[hsl(180,100%,50%)]/50 text-[hsl(180,100%,70%)] shadow-[0_0_10px_rgba(0,255,255,0.15)]' : 'bg-[hsl(260,20%,12%)] border-white/10 text-[hsl(180,50%,45%)] hover:border-white/20'}`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Generate button */}
                      <button
                        type="button"
                        onClick={handleGenerateClips}
                        disabled={isGeneratingClips || selectedPlatforms.length === 0}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded bg-gradient-to-r from-[hsl(180,100%,50%)] to-[hsl(300,80%,50%)] text-[hsl(260,30%,6%)] font-bold text-sm hover:shadow-[0_0_30px_rgba(0,255,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGeneratingClips ? (
                          <><RefreshCw size={16} className="animate-spin" /> Analyzing Moments... Generating Clips...</>
                        ) : (
                          <><Sparkles size={16} /> Generate Clips</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Clip Results View ── */
                <div className="space-y-5 pb-8">
                  {/* Header */}
                  <div className="p-5 pb-0">
                    <button
                      type="button"
                      onClick={() => setShowClipResults(false)}
                      className="flex items-center gap-1 text-xs text-[hsl(180,50%,45%)] hover:text-[hsl(180,100%,70%)] transition-colors mb-3"
                    >
                      <ArrowLeft size={14} /> Back to Video Details
                    </button>
                    <h2 className="text-lg font-bold text-[hsl(180,100%,70%)]" style={{ textShadow: '0 0 8px rgba(0,255,255,0.3)' }}>
                      <span className="flex items-center gap-2"><Scissors size={18} /> Generated Clips</span>
                    </h2>
                    <p className="text-sm text-[hsl(180,50%,45%)] mt-1 truncate">
                      Source: {clipSourceTitle || selectedVideo?.title || 'Unknown'}
                    </p>
                    {clips.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-[hsl(180,100%,50%)]">
                        <CheckCircle size={14} />
                        <span>{clips.length} clips generated</span>
                      </div>
                    )}
                  </div>

                  {/* Processing summary */}
                  {clipProcessingSummary && (
                    <div className="mx-5 p-3 rounded bg-[hsl(260,25%,12%)] border border-white/5 text-xs">
                      {renderMarkdown(clipProcessingSummary)}
                    </div>
                  )}

                  {/* Clips list */}
                  <div className="px-5 space-y-3">
                    {Array.isArray(clips) && clips.map((clip: GeneratedClip, idx: number) => (
                      <ClipCard
                        key={clip?.clip_id ?? idx}
                        clip={clip}
                        artifactFile={Array.isArray(artifactFiles) ? artifactFiles[idx] : undefined}
                        index={idx}
                      />
                    ))}

                    {clips.length === 0 && !isGeneratingClips && (
                      <div className="text-center py-8 text-sm text-[hsl(180,50%,45%)]">
                        No clips were generated. Try adjusting your settings and generating again.
                      </div>
                    )}
                  </div>

                  {/* Batch download */}
                  {Array.isArray(artifactFiles) && artifactFiles.length > 0 && (
                    <div className="px-5">
                      <div className="border-t border-white/10 pt-4">
                        <h3 className="text-xs text-[hsl(180,50%,45%)] uppercase tracking-wider mb-2">Downloadable Files</h3>
                        <div className="space-y-2">
                          {artifactFiles.map((file: ArtifactFile, idx: number) => (
                            <a
                              key={idx}
                              href={file?.file_url ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 rounded bg-[hsl(260,25%,12%)] border border-white/5 text-xs text-[hsl(180,100%,70%)] hover:border-[hsl(180,100%,50%)]/30 transition-all"
                            >
                              <Download size={14} className="text-[hsl(180,100%,50%)] flex-shrink-0" />
                              <span className="truncate flex-1">{file?.name ?? `Clip ${idx + 1}`}</span>
                              {file?.format_type && (
                                <span className="px-1.5 py-0.5 rounded bg-[hsl(260,20%,18%)] text-[hsl(180,50%,45%)] text-[10px] uppercase">{file.format_type}</span>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Back to discover */}
                  <div className="px-5 pt-2">
                    <button
                      type="button"
                      onClick={() => { setShowDetailPanel(false); setShowClipResults(false) }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded border border-[hsl(180,100%,50%)]/30 text-[hsl(180,100%,70%)] text-sm font-bold hover:bg-[hsl(180,100%,50%)]/10 transition-all"
                    >
                      <TrendingUp size={14} /> Back to Discover
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </ErrorBoundary>
  )
}
