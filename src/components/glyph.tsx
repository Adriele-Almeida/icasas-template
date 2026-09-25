import { iconById, type IconNode } from "@/lib/icon-catalog"

export function Glyph({
  id,
  size = 22,
  strokeWidth = 1.7,
}: {
  id: string
  size?: number
  strokeWidth?: number
}) {
  const icon = iconById(id)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {icon.nodes.map((node, index) => (
        <SvgNode key={index} node={node} />
      ))}
    </svg>
  )
}

function SvgNode({ node }: { node: IconNode }) {
  const props = node.attrs
  switch (node.tag) {
    case "path":
      return <path {...props} />
    case "circle":
      return <circle {...props} />
    case "rect":
      return <rect {...props} />
    case "polyline":
      return <polyline {...props} />
    case "line":
      return <line {...props} />
    case "polygon":
      return <polygon {...props} />
    case "ellipse":
      return <ellipse {...props} />
    default:
      return null
  }
}
