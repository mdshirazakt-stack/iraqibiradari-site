import { mountObituaryForm } from './obituary-form.js';
const q = new URLSearchParams(location.search);
mountObituaryForm(document.getElementById('obit-form-root'), { mode: 'edit', id: q.get('id') || '', token: q.get('k') || '' });
