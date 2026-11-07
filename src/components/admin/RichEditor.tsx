import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Youtube from '@tiptap/extension-youtube';
import { TableKit } from '@tiptap/extension-table';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Code2, ImagePlus, Italic, Link2, List, ListOrdered,
  Minus, Quote, Redo2, Table2, Type, Underline as UnderlineIcon, Undo2, Video, Captions, Rows3, Columns3, Trash2,
} from 'lucide-react';
import { MediaPicker, mediumUrl } from './MediaPicker';
import { Modal } from './kit';

function TextPrompt({ title, label, initial = '', placeholder, onSubmit, onClose, allowEmpty = false }: { title: string; label: string; initial?: string; placeholder?: string; onSubmit: (value: string) => void; onClose: () => void; allowEmpty?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (allowEmpty || value.trim()) onSubmit(value.trim()); }}>
        <label className="label" htmlFor="prompt-input">{label}</label>
        <input id="prompt-input" className="field" value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button type="submit" className="btn" disabled={!allowEmpty && !value.trim()}>Terapkan</button>
        </div>
      </form>
    </Modal>
  );
}

function Btn({ label, onClick, active, disabled, children }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled} aria-label={label} title={label} aria-pressed={active}
      className={`grid size-10 shrink-0 place-items-center rounded text-sm transition-colors disabled:opacity-35 ${active ? 'bg-ink text-bg' : 'hover:bg-soft'}`}>
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden="true" />;

function Toolbar({ editor, openImage, openLink, openVideo, openCaption }: { editor: Editor; openImage: () => void; openLink: () => void; openVideo: () => void; openCaption: () => void }) {
  const icon = 'size-[18px]';
  const inTable = editor.isActive('table');
  const heading = [1, 2, 3, 4].find((l) => editor.isActive('heading', { level: l })) ?? 0;
  return (
    <div role="toolbar" aria-label="Format teks" className="sticky top-[var(--editor-top,0px)] z-10 flex items-center gap-0.5 overflow-x-auto rounded-t border-b border-line bg-bg px-1 py-1">
      <Btn label="Urungkan" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo2 className={icon} aria-hidden="true" /></Btn>
      <Btn label="Ulangi" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo2 className={icon} aria-hidden="true" /></Btn>
      <Sep />
      <label className="sr-only" htmlFor="heading-select">Gaya paragraf</label>
      <select id="heading-select" value={heading} onChange={(e) => { const v = Number(e.target.value); const c = editor.chain().focus(); (v ? c.setHeading({ level: v as 1 | 2 | 3 | 4 }) : c.setParagraph()).run(); }} className="h-10 shrink-0 rounded border border-line bg-bg px-2 text-sm">
        <option value={0}>Paragraf</option>
        {[1, 2, 3, 4].map((l) => <option key={l} value={l}>Judul {l}</option>)}
      </select>
      <Sep />
      <Btn label="Tebal" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className={icon} aria-hidden="true" /></Btn>
      <Btn label="Miring" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className={icon} aria-hidden="true" /></Btn>
      <Btn label="Garis bawah" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className={icon} aria-hidden="true" /></Btn>
      <Btn label="Tautan" active={editor.isActive('link')} onClick={openLink}><Link2 className={icon} aria-hidden="true" /></Btn>
      <Sep />
      <Btn label="Kutipan" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className={icon} aria-hidden="true" /></Btn>
      <Btn label="Daftar poin" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className={icon} aria-hidden="true" /></Btn>
      <Btn label="Daftar nomor" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className={icon} aria-hidden="true" /></Btn>
      <Sep />
      <Btn label="Rata kiri" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className={icon} aria-hidden="true" /></Btn>
      <Btn label="Rata tengah" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className={icon} aria-hidden="true" /></Btn>
      <Btn label="Rata kanan" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className={icon} aria-hidden="true" /></Btn>
      <Btn label="Rata kanan-kiri" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className={icon} aria-hidden="true" /></Btn>
      <Sep />
      <Btn label="Sisipkan gambar" onClick={openImage}><ImagePlus className={icon} aria-hidden="true" /></Btn>
      <Btn label="Ubah keterangan gambar" disabled={!editor.isActive('image')} onClick={openCaption}><Captions className={icon} aria-hidden="true" /></Btn>
      <Btn label="Sisipkan video YouTube" onClick={openVideo}><Video className={icon} aria-hidden="true" /></Btn>
      <Btn label="Sisipkan tabel" active={inTable} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className={icon} aria-hidden="true" /></Btn>
      {inTable && (
        <>
          <Btn label="Tambah baris" onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 className={icon} aria-hidden="true" /></Btn>
          <Btn label="Tambah kolom" onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 className={icon} aria-hidden="true" /></Btn>
          <Btn label="Hapus tabel" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className={icon} aria-hidden="true" /></Btn>
        </>
      )}
      <Btn label="Garis pemisah" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className={icon} aria-hidden="true" /></Btn>
      <Btn label="Blok kode" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 className={icon} aria-hidden="true" /></Btn>
      <Btn label="Hapus format" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><Type className={icon} aria-hidden="true" /></Btn>
    </div>
  );
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Mengganti isi editor dari luar (mis. saat memulihkan draft). Ubah nilainya untuk memuat ulang. */
  resetKey?: string | number;
}

/**
 * Editor teks kaya berbasis TipTap. Padanan HTML-nya: seperti elemen <div contenteditable> dengan tombol
 * toolbar; hasilnya tetap berupa HTML biasa yang disimpan ke file JSON oleh server (dibersihkan lagi di server).
 */
export default function RichEditor({ value, onChange, placeholder = 'Mulai menulis…', resetKey }: Props) {
  const [dialog, setDialog] = useState<null | 'image' | 'link' | 'video' | 'caption'>(null);
  const lastEmitted = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } } }),
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      Youtube.configure({ nocookie: true, width: 640, height: 360, controls: true }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: value,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: 'prose-article', 'aria-label': 'Isi tulisan', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? '' : ed.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    if (editor && value !== lastEmitted.current) {
      lastEmitted.current = value;
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return <div className="skeleton h-96 w-full" role="status" aria-label="Memuat editor" />;

  return (
    <div className="editor-surface rounded border border-line bg-bg focus-within:border-muted">
      <Toolbar editor={editor} openImage={() => setDialog('image')} openLink={() => setDialog('link')} openVideo={() => setDialog('video')} openCaption={() => setDialog('caption')} />
      <EditorContent editor={editor} />

      {dialog === 'image' && (
        <MediaPicker
          onClose={() => setDialog(null)}
          onSelect={(m) => {
            editor.chain().focus().setImage({ src: mediumUrl(m), alt: m.alt || m.name, title: '' }).run();
            setDialog(null);
          }}
        />
      )}
      {dialog === 'link' && (
        <TextPrompt title="Tautan" label="Alamat URL (kosongkan untuk menghapus tautan)" allowEmpty placeholder="https://" initial={(editor.getAttributes('link').href as string) ?? ''} onClose={() => setDialog(null)}
          onSubmit={(url) => {
            const chain = editor.chain().focus().extendMarkRange('link');
            if (!url) chain.unsetLink().run();
            else if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) chain.setLink({ href: url }).run();
            else chain.setLink({ href: `https://${url}` }).run();
            setDialog(null);
          }} />
      )}
      {dialog === 'video' && (
        <TextPrompt title="Video YouTube" label="Tempel tautan video YouTube" placeholder="https://www.youtube.com/watch?v=…" onClose={() => setDialog(null)}
          onSubmit={(src) => { editor.chain().focus().setYoutubeVideo({ src }).run(); setDialog(null); }} />
      )}
      {dialog === 'caption' && (
        <TextPrompt title="Keterangan gambar" label="Teks keterangan (tampil di bawah gambar)" allowEmpty initial={(editor.getAttributes('image').title as string) ?? ''} onClose={() => setDialog(null)}
          onSubmit={(text) => { editor.chain().focus().updateAttributes('image', { title: text || null }).run(); setDialog(null); }} />
      )}
    </div>
  );
}
