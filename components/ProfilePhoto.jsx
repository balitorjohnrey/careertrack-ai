import { useRef, useState } from 'react';
import { squarePhoto } from '../lib/square-photo.mjs';
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
              if (file) run(async () => setPending(await squarePhoto(file, { pixels: 256, maxLength: 44000 })));
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
