import { useState } from 'react';
import { api } from '../api';

export default function ResourceEditor({ resource, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function save(e, replacement = false) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = new FormData(form);
      const file = body.get('file');
      if (replacement && file.size > 100 * 1024 * 1024)
        throw new Error('Maximum file size is 100 MB.');
      await api('/api/admin/resources/' + resource.id + (replacement ? '/file' : ''), {
        method: replacement ? 'POST' : 'PATCH',
        body: replacement ? body : Object.fromEntries(body),
      });
      if (replacement) form.reset();
      await onSaved();
      setNotice(
        replacement
          ? 'File replaced. Existing purchases keep their original file.'
          : 'Listing saved.',
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="resource-editor">
      <summary>Edit listing & file</summary>
      <form onSubmit={save}>
        <label>
          Listing title
          <input
            name="title"
            defaultValue={resource.title}
            minLength={4}
            maxLength={120}
            required
          />
        </label>
        <label>
          Listing description
          <textarea
            name="description"
            defaultValue={resource.description}
            minLength={10}
            maxLength={1000}
            required
          />
        </label>
        <label>
          Listing license
          <textarea
            name="license"
            defaultValue={resource.license}
            minLength={10}
            maxLength={1000}
            required
          />
        </label>
        <button className="button secondary small" disabled={busy}>
          Save listing
        </button>
      </form>
      {resource.hasFile && (
        <a className="text-button" href={'/api/admin/resources/' + resource.id + '/file'}>
          Download uploaded file
        </a>
      )}
      <form onSubmit={(e) => save(e, true)}>
        <label>
          Replacement file
          <input type="file" name="file" required />
        </label>
        <p className="fineprint">
          Maximum 100 MB. Replacing a file keeps its current publication status. Publish it when
          ready.
        </p>
        <button className="button secondary small" disabled={busy}>
          {busy ? 'Saving…' : 'Replace file'}
        </button>
      </form>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert success" role="status">
          {notice}
        </div>
      )}
    </details>
  );
}
