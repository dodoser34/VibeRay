import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth';
import { isModerator } from '@/shared/config/roles';
import { updateProfile, uploadAvatar } from '@/shared/api/endpoints/users';
import { NICKNAME_PATTERN } from '@/shared/config/validation';
import { Avatar } from '@/shared/ui/avatar/Avatar';
import { TextField } from '@/shared/ui/controls/TextField';
import { useSaveAction } from '../hooks/useSaveAction';
import { AvatarPicker } from './AvatarPicker';
import { SaveBar } from './SaveBar';
import { SettingsSection } from './SettingsSection';
import auth from '@/texts/ru/auth.json';
import texts from '@/texts/ru/settings.json';
import styles from './ProfileSection.module.css';
import { Icon } from '@/shared/ui/icons/Icon';

const isPreset = (src) => /^preset:\d+$/.test(src ?? '');
const NICKNAME_ERRORS = ['nickname_taken', 'invalid_nickname'];

// Публичная часть профиля: только аватар и никнейм (CLAUDE.md, раздел 5).
export function ProfileSection({ id }) {
  const { user, updateUser } = useAuth();
  const save = useSaveAction();
  const [nickname, setNickname] = useState(user.nickname);
  const savedAvatar = user.avatar_url ?? 'preset:0';
  const [avatar, setAvatar] = useState(savedAvatar);
  // Своё фото, ещё не отправленное на сервер: { blob, url } (url — локальный предпросмотр)
  const [upload, setUpload] = useState(null);
  const [nicknameError, setNicknameError] = useState('');

  useEffect(() => () => upload && URL.revokeObjectURL(upload.url), [upload]);

  const savedCustom = isPreset(user.avatar_url) ? null : user.avatar_url;
  const customSrc = upload?.url ?? savedCustom;
  const dirty = nickname !== user.nickname || avatar !== savedAvatar;

  const reset = () => {
    setNickname(user.nickname);
    setAvatar(savedAvatar);
    setUpload(null);
    setNicknameError('');
    save.reset();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!NICKNAME_PATTERN.test(nickname)) {
      setNicknameError(auth.errors.nicknameInvalid);
      return;
    }
    const outcome = await save.run(async () => {
      let next = user;
      if (upload && avatar === upload.url) next = await uploadAvatar(upload.blob);
      const patch = {};
      if (nickname !== user.nickname) patch.nickname = nickname;
      if (isPreset(avatar) && avatar !== savedAvatar) patch.avatarUrl = avatar;
      if (Object.keys(patch).length) next = await updateProfile(patch);
      return next;
    });
    if (outcome.ok) {
      updateUser(outcome.result);
      setAvatar(outcome.result.avatar_url);
      setUpload(null);
    } else if (NICKNAME_ERRORS.includes(outcome.error.code)) {
      setNicknameError(outcome.error.message);
    }
  };

  return (
    <SettingsSection id={id} title={texts.sections.profile} lead={texts.profile.lead}>
      <form className={styles.layout} onSubmit={handleSubmit} noValidate>
        <div className={styles.inner}>
          <figure className={styles.card} aria-label={texts.profile.previewLabel}>
            <figcaption className={styles.cardLabel}>{texts.profile.previewLabel}</figcaption>
            <Avatar src={avatar} size={88} className={styles.cardAvatar} />
            <p className={styles.cardName}>{nickname || user.nickname}</p>
            <p className={styles.cardMeta}>
              {isModerator(user) ? texts.moderator.previewMeta : texts.profile.previewMeta}
            </p>
            <p className={styles.lock}>
              <Icon name="lock" size={12} />
              {texts.profile.public}
            </p>
          </figure>

          <div className={styles.fields}>
            <TextField
              label={auth.fields.nickname}
              autoComplete="nickname"
              maxLength={24}
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setNicknameError('');
              }}
              error={nicknameError}
              hint={texts.profile.nicknameHint}
            />
            <AvatarPicker
              value={avatar}
              customSrc={customSrc}
              onChange={setAvatar}
              onUpload={(blob) => {
                const url = URL.createObjectURL(blob);
                setUpload({ blob, url });
                setAvatar(url);
              }}
            />
          </div>

          <div className={styles.footer}>
            <SaveBar
              status={save.status}
              error={
                save.error && !NICKNAME_ERRORS.includes(save.error.code) ? save.error.message : ''
              }
              dirty={dirty}
              saveLabel={texts.profile.save}
              onReset={reset}
            />
          </div>
        </div>
      </form>
    </SettingsSection>
  );
}
