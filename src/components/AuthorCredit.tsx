import { cx } from '../lib/text';
import { Icon } from './Icon';

export const AUTHOR = { name: 'Micheal A Ibrahim', url: 'https://mr-mike-site.onrender.com' } as const;

export function AuthorCredit({ className }: { className?: string }) {
  return (
    <p className={cx('text-xs text-slate-500 dark:text-slate-400', className)}>
      Built by{' '}
      <a
        href={AUTHOR.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
      >
        {AUTHOR.name}
        <Icon name="link" className="size-3" />
        <span className="sr-only">(portfolio, opens in a new tab)</span>
      </a>
    </p>
  );
}
