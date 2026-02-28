interface ExternalLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
}

export function ExternalLink({ href, className, children }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
