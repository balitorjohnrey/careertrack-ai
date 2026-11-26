import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { api, ErrorBox, useAction } from './common';

export function ProfileAvatar({ name, photo }) {
  const initials = (name || 'Student')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toUpperCase();
  return photo ? (
    <img className="profile-avatar" alt="" src={'data:image/jpeg;base64,' + photo} />
  ) : (
    <b className="profile-avatar" aria-hidden="true">
      {initials}
    </b>
  );
}

async function makeThumbnail(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPG, PNG, or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error('This image could not be opened. Choose another photo.');
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not prepare this photo.');
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    );
    for (const quality of [0.84, 0.66, 0.48]) {
      const jpeg = canvas.toDataURL('image/jpeg', quality).split(',')[1];
      if (jpeg && jpeg.length <= 44000) return jpeg;
    }
    throw new Error('This photo could not be resized. Choose another image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ProfilePhoto({ profile, reload, notify }) {
  const input = useRef(null);
  const [pending, setPending] = useState(null);
  const { busy, error, setError, run } = useAction();
  const available = Object.hasOwn(profile, 'photo_jpeg');
  const displayed = pending || profile.photo_jpeg;
  function save(photo) {
    run(async () => {
      await api('profile/photo', { photo });
      await reload();
      setPending(null);
      notify(photo ? 'Profile photo saved.' : 'Profile photo removed.');
    });
  }
  return (
    <section className="card edit-form photo-card" aria-labelledby="profile-photo-title">
      <div className="photo-layout">
        <ProfileAvatar name={profile.full_name} photo={displayed} />
        <div className="photo-controls">
          <h2 id="profile-photo-title">Profile photo</h2>
          <p className="card-note">
            {available
              ? 'Choose a JPG, PNG, or WebP up to 10 MB.'
              : 'Photo uploads are awaiting a database update from the project owner.'}
          </p>
          <input
            type="file"
            hidden
            ref={input}
            aria-label="Choose profile photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) run(async () => setPending(await makeThumbnail(file)));
            }}
          />
          {available && (
            <div className="actions">
              {pending && (
                <button
                  className="button dark"
                  type="button"
                  disabled={busy}
                  onClick={() => save(pending)}
                >
                  Save photo
                </button>
              )}
              <button
                className="button light"
                type="button"
                disabled={busy}
                onClick={() => input.current.click()}
              >
                <Camera size={16} /> {displayed ? 'Change photo' : 'Upload photo'}
              </button>
              {pending ? (
                <button
                  className="quiet-button"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPending(null);
                    setError('');
                  }}
                >
                  Cancel
                </button>
              ) : (
                profile.photo_jpeg && (
                  <button
                    className="quiet-button danger"
                    type="button"
                    disabled={busy}
                    onClick={() => save(null)}
                  >
                    Remove photo
                  </button>
                )
              )}
            </div>
          )}
          <ErrorBox message={error} />
        </div>
      </div>
    </section>
  );
}
