import { ExternalLink } from 'lucide-react'
import type { SuccessCaseVideo } from '../types'

export function SuccessCaseVideoCard({ video }: { video: SuccessCaseVideo }) {
  return (
    <article className="case-video-card">
      <div className="case-video-frame">
        <iframe
          title={video.title}
          src={`https://www.youtube.com/embed/${video.youtube_id}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>
      <div>
        <span>VIDEO DE CASO</span>
        <h3>{video.title}</h3>
        <p>{video.description}</p>
        <a href={video.video_url} target="_blank" rel="noreferrer">
          Ver en YouTube <ExternalLink />
        </a>
      </div>
    </article>
  )
}
