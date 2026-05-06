'use client';

/**
 * Lekki WYSIWYG editor — Tiptap StarterKit (bold/italic/heading/list/link/quote)
 * + zewnetrzny toolbar. Output: HTML (sanitizowany przed renderem na publicznej
 * ofercie przez `sanitizeRichText()`).
 */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
};

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 160 }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'rt-editor-content',
        style: `min-height:${minHeight}px;padding:10px;outline:none;`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Tiptap zwraca '<p></p>' dla pustego inputu — normalizujemy do ''.
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  // Synchronizacja z external value (np. reset formy po zapisie).
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value && editor.getHTML() !== '<p></p>') return;
    if (value && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return <div style={fallbackStyle}>Ładowanie edytora…</div>;

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    background: active ? '#1B2A4A' : '#fff',
    color: active ? '#fff' : '#1B2A4A',
    border: '1px solid #e4e9f2',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'inherit',
  });

  return (
    <div style={wrapStyle}>
      <div style={toolbarStyle}>
        <button
          type="button"
          aria-label="Pogrubienie"
          onClick={() => editor.chain().focus().toggleBold().run()}
          style={btn(editor.isActive('bold'))}
        >
          B
        </button>
        <button
          type="button"
          aria-label="Kursywa"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          style={{ ...btn(editor.isActive('italic')), fontStyle: 'italic' }}
        >
          I
        </button>
        <button
          type="button"
          aria-label="Naglowek"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          style={btn(editor.isActive('heading', { level: 3 }))}
        >
          H
        </button>
        <button
          type="button"
          aria-label="Lista punktowana"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          style={btn(editor.isActive('bulletList'))}
        >
          •
        </button>
        <button
          type="button"
          aria-label="Lista numerowana"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          style={btn(editor.isActive('orderedList'))}
        >
          1.
        </button>
        <button
          type="button"
          aria-label="Cytat"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          style={btn(editor.isActive('blockquote'))}
        >
          &rdquo;
        </button>
        <button
          type="button"
          aria-label="Cofnij"
          onClick={() => editor.chain().focus().undo().run()}
          style={btn(false)}
        >
          ↶
        </button>
        <button
          type="button"
          aria-label="Ponow"
          onClick={() => editor.chain().focus().redo().run()}
          style={btn(false)}
        >
          ↷
        </button>
      </div>
      {placeholder && editor.isEmpty && (
        <div style={placeholderStyle} aria-hidden>
          {placeholder}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  position: 'relative',
  border: '1px solid #e4e9f2',
  borderRadius: 4,
  background: '#fff',
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  padding: 6,
  borderBottom: '1px solid #e4e9f2',
  background: '#f7f9fc',
};

const placeholderStyle: React.CSSProperties = {
  position: 'absolute',
  top: 50,
  left: 14,
  color: '#9aa3b3',
  fontSize: 14,
  pointerEvents: 'none',
};

const fallbackStyle: React.CSSProperties = {
  padding: 12,
  border: '1px solid #e4e9f2',
  borderRadius: 4,
  fontSize: 13,
  color: '#6b7a92',
};
