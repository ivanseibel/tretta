'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AVATARS, type Avatar } from '@tretta/protocol/shared';
import { useRoom } from '@/app/providers';
import { COLOR_SYMBOLS } from '@/lib/labels';
import type { Color } from '@tretta/rules';

export const AVATAR_LABELS: Record<Avatar, string> = {
  raposa: 'Raposa',
  pinguim: 'Pinguim',
  tucano: 'Tucano',
  lobo: 'Lobo',
  coruja: 'Coruja',
  polvo: 'Polvo',
  lince: 'Lince',
  sapo: 'Sapo',
};

export function ColorSymbol({ color }: { color: Color }): ReactNode {
  return <span className={`color-symbol color-symbol-${color}`} aria-hidden="true">{COLOR_SYMBOLS[color]}</span>;
}

function AvatarIllustration({ avatar }: { avatar: Avatar }): ReactNode {
  switch (avatar) {
    case 'raposa':
      return (
        <>
          <path fill="#d66a35" d="m8 7 10 8a18 18 0 0 1 12 0l10-8-2 20c-1 9-6 14-14 14S11 36 10 27L8 7Z" />
          <path fill="#ffe6c8" d="M14 23c2-4 5-5 10-5s8 1 10 5l-3 8c-4 5-10 5-14 0l-3-8Z" />
          <circle cx="19" cy="24" r="1.5" fill="#243c30" />
          <circle cx="29" cy="24" r="1.5" fill="#243c30" />
          <path fill="#243c30" d="m22 30 2-2 2 2-2 2-2-2Z" />
        </>
      );
    case 'pinguim':
      return (
        <>
          <ellipse cx="24" cy="27" rx="17" ry="19" fill="#385766" />
          <ellipse cx="24" cy="31" rx="11" ry="13" fill="#fff4dc" />
          <circle cx="18" cy="22" r="2" fill="#fff" />
          <circle cx="30" cy="22" r="2" fill="#fff" />
          <circle cx="18" cy="22" r="1" fill="#243c30" />
          <circle cx="30" cy="22" r="1" fill="#243c30" />
          <path fill="#efaa35" d="m20 26 4-2 4 2-4 4-4-4Z" />
        </>
      );
    case 'tucano':
      return (
        <>
          <path fill="#245c55" d="M9 18c3-9 10-13 19-11 9 2 14 10 12 20-2 10-9 15-18 14-10-1-16-10-13-23Z" />
          <circle cx="29" cy="18" r="2" fill="#fff5de" />
          <circle cx="29" cy="18" r="1" fill="#243c30" />
          <path fill="#efb642" d="M28 22c9-5 17-4 17 1-1 7-9 10-18 6l-7-3 8-4Z" />
          <path fill="#d66a35" d="m31 23 12-1c-1 4-5 7-11 7l-6-2 5-4Z" />
        </>
      );
    case 'lobo':
      return (
        <>
          <path fill="#73818a" d="m8 17 3-13 11 10h5L38 4l2 14c2 13-4 25-16 26C12 43 6 31 8 17Z" />
          <path fill="#e8dfc9" d="M14 25c2-6 6-8 10-8s8 2 10 8l-3 8c-4 5-10 5-14 0l-3-8Z" />
          <circle cx="19" cy="23" r="1.5" fill="#243c30" />
          <circle cx="29" cy="23" r="1.5" fill="#243c30" />
          <path fill="#243c30" d="m21 30 3-2 3 2-3 3-3-3Z" />
        </>
      );
    case 'coruja':
      return (
        <>
          <path fill="#a95c42" d="m8 19 4-13 9 8c2-1 4-1 6 0l9-8 4 13c2 14-5 24-16 24S6 33 8 19Z" />
          <circle cx="18" cy="23" r="7" fill="#fff0cd" />
          <circle cx="30" cy="23" r="7" fill="#fff0cd" />
          <circle cx="18" cy="23" r="2" fill="#243c30" />
          <circle cx="30" cy="23" r="2" fill="#243c30" />
          <path fill="#efb642" d="m21 29 3-4 3 4-3 4-3-4Z" />
        </>
      );
    case 'polvo':
      return (
        <>
          <path d="M12 33c-5 6-1 10 4 6m2-4c-2 8 4 10 7 4m2-4c1 8 7 8 8 1m-1-8c6 4 9 0 5-5" fill="none" stroke="#8254a4" strokeLinecap="round" strokeWidth="5" />
          <path fill="#9667b4" d="M9 24c0-10 6-17 15-17s15 7 15 17c0 8-6 13-15 13S9 32 9 24Z" />
          <circle cx="18" cy="23" r="3" fill="#fff4dc" />
          <circle cx="30" cy="23" r="3" fill="#fff4dc" />
          <circle cx="18" cy="23" r="1.3" fill="#243c30" />
          <circle cx="30" cy="23" r="1.3" fill="#243c30" />
          <path d="M20 30c2 2 6 2 8 0" fill="none" stroke="#243c30" strokeLinecap="round" strokeWidth="1.5" />
        </>
      );
    case 'lince':
      return (
        <>
          <path fill="#c78b37" d="m8 17 3-11 8 8c3-1 7-1 10 0l8-8 3 12c2 13-5 25-16 25S6 30 8 17Z" />
          <path fill="#f1ddae" d="M14 25c2-5 6-7 10-7s8 2 10 7l-3 8c-4 4-10 4-14 0l-3-8Z" />
          <path fill="#fff0d0" d="m8 11 4 5-5 1m28-6-4 5 6 1" />
          <circle cx="19" cy="23" r="1.5" fill="#243c30" />
          <circle cx="29" cy="23" r="1.5" fill="#243c30" />
          <path fill="#243c30" d="m21 30 3-2 3 2-3 2-3-2Z" />
        </>
      );
    case 'sapo':
      return (
        <>
          <path fill="#5a974c" d="M7 25c0-10 7-16 17-16s17 6 17 16c0 10-7 16-17 16S7 35 7 25Z" />
          <ellipse cx="15" cy="15" rx="7" ry="8" fill="#74ad5c" />
          <ellipse cx="33" cy="15" rx="7" ry="8" fill="#74ad5c" />
          <circle cx="15" cy="15" r="3.2" fill="#fff5de" />
          <circle cx="33" cy="15" r="3.2" fill="#fff5de" />
          <circle cx="15" cy="15" r="1.5" fill="#243c30" />
          <circle cx="33" cy="15" r="1.5" fill="#243c30" />
          <path d="M17 30c4 4 10 4 14 0" fill="none" stroke="#243c30" strokeLinecap="round" strokeWidth="2" />
        </>
      );
  }
}

export function AvatarBadge({ avatar, size = 'normal' }: { avatar: Avatar; size?: 'normal' | 'small' }): ReactNode {
  return (
    <span className={`avatar-badge avatar-${size} avatar-${avatar}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" focusable="false" aria-hidden="true">
        <AvatarIllustration avatar={avatar} />
      </svg>
    </span>
  );
}

/**
 * Avatar acionável para abrir o menu de humor. O rótulo acessível nomeia a
 * ação e o alvo; o botão nunca envolve outro controle (o nome consultável dos
 * assentos continua sendo um botão irmão).
 */
export function AvatarAction({
  avatar,
  label,
  testId,
  onActivate,
  size = 'normal',
}: {
  avatar: Avatar;
  label: string;
  testId?: string;
  onActivate: (trigger: HTMLButtonElement) => void;
  size?: 'normal' | 'small';
}): ReactNode {
  return (
    <button
      type="button"
      className="avatar-action"
      aria-label={label}
      data-testid={testId}
      onClick={(event) => onActivate(event.currentTarget)}
    >
      <AvatarBadge avatar={avatar} size={size} />
    </button>
  );
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value: Avatar;
  onChange: (avatar: Avatar) => void;
}): ReactNode {
  return (
    <div className="avatar-picker" role="group" aria-label="Escolha um avatar">
      {AVATARS.map((avatar) => (
        <button
          key={avatar}
          type="button"
          aria-pressed={value === avatar}
          className={value === avatar ? 'avatar-option avatar-option-selected' : 'avatar-option'}
          data-testid={`avatar-option-${avatar}`}
          onClick={() => onChange(avatar)}
        >
          <AvatarBadge avatar={avatar} />
          <span>{AVATAR_LABELS[avatar]}</span>
        </button>
      ))}
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }): ReactNode {
  return (
    <div className="error-banner" role="alert" data-testid="error-banner">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} data-testid="error-dismiss">
        Fechar
      </button>
    </div>
  );
}

/** Saída explícita da sala; durante a rodada o substituto assume a vaga. */
export function LeaveButton(): ReactNode {
  const room = useRoom();
  const router = useRouter();
  return (
    <button
      type="button"
      className="secondary leave-button"
      data-testid="leave-button"
      disabled={!room.interactive}
      onClick={() => {
        void (async () => {
          const left = await room.leaveRoom();
          if (left) router.push('/');
        })();
      }}
    >
      Sair da sala
    </button>
  );
}
