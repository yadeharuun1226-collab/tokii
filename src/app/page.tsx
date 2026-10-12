'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Entry {
  PK: string;
  SK: string;
  content: string;
  tags?: string[];
  imageUrl?: string;
  created_at?: string;
}

// 外部パッケージ不要の軽量インラインSVGアイコン
const PenIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M2.5 22v-6h6" />
    <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M2.5 16l1.2 1.2A10 10 0 0 0 22 12.5" />
  </svg>
);

const LayersIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [randomEntry, setRandomEntry] = useState<Entry | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [randomTag, setRandomTag] = useState<string>('all');
  
  // タイムライン開閉状態
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  // 投稿フォーム状態
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    initializeAppData();
  }, []);

  const initializeAppData = async () => {
    try {
      const listRes = await fetch(`${API_URL}/entries`, { cache: 'no-store' });
      if (listRes.ok) {
        const listData = await listRes.json();
        if (Array.isArray(listData) && listData.length > 0) {
          setEntries(listData);
        }
      }

      const randomRes = await fetch(`${API_URL}/entries/random`, { cache: 'no-store' });
      if (randomRes.ok) {
        const randomData = await randomRes.json();
        if (randomData) {
          setRandomEntry(randomData);
        }
      }
    } catch (err) {
      console.error('Initialization error:', err);
    }
  };

  const handleToggleTimeline = () => {
    setIsTimelineOpen((prev) => !prev);
  };

  const handleFetchRandom = async () => {
    try {
      setStatus('過去の記憶を呼び起こしています...');
      
      const res = await fetch(`${API_URL}/entries/random`, { cache: 'no-store' });
      if (!res.ok) throw new Error('記憶が見つかりませんでした');

      const data = await res.json();
      if (data) {
        setEntries((prev) => (prev.some((item) => item.SK === data.SK) ? prev : [data, ...prev]));
        
        const targetEntries = randomTag === 'all' 
          ? [data, ...entries] 
          : [data, ...entries].filter((e) => e.tags?.includes(randomTag));

        if (targetEntries.length > 0) {
          const randomIndex = Math.floor(Math.random() * targetEntries.length);
          setRandomEntry(targetEntries[randomIndex]);
        } else {
          setRandomEntry(data);
        }
        setStatus('');
      } else {
        setStatus('登録されている記憶がありません');
      }
    } catch (err: any) {
      setStatus(`エラー: ${err.message}`);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      setIsSubmitting(true);
      let imageUrl = '';

      if (imageFile) {
        setStatus('画像をアップロード中...');
        const resUrl = await fetch(`${API_URL}/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: imageFile.name,
            fileType: imageFile.type,
          }),
        });

        if (!resUrl.ok) throw new Error('アップロードURLの取得に失敗しました');
        
        const data = await resUrl.json();
        const { uploadUrl, fileUrl } = data;

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': imageFile.type },
          body: imageFile,
        });

        if (!uploadRes.ok) throw new Error('S3への画像送信に失敗しました');
        imageUrl = fileUrl;
      }

      setStatus('記憶を刻んでいます...');
      const tagArray = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      
      const res = await fetch(`${API_URL}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          tags: tagArray,
          imageUrl: imageUrl || undefined,
        }),
      });

      if (!res.ok) throw new Error('投稿に失敗しました');

      const newEntryData = await res.json();
      const createdItem = newEntryData.item || {
        PK: 'USER#demo-user',
        SK: `ENTRY#${Date.now()}`,
        content,
        tags: tagArray,
        imageUrl,
        created_at: new Date().toISOString(),
      };

      setEntries((prev) => [createdItem, ...prev].slice(0, 10));
      setRandomEntry(createdItem);

      setStatus('記憶が刻まれました');
      setContent('');
      setTags('');
      setImageFile(null);
      setImagePreview(null);
      setShowForm(false);
      setTimeout(() => setStatus(''), 3000);
    } catch (err: any) {
      console.error('Error in handleCreateEntry:', err);
      setStatus(`エラー: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (pk: string, sk: string) => {
    if (!window.confirm('この記憶を削除してもよろしいですか？')) return;

    try {
      const res = await fetch(
        `${API_URL}/entries?pk=${encodeURIComponent(pk)}&sk=${encodeURIComponent(sk)}`,
        {
          method: 'DELETE',
        }
      );

      if (!res.ok) throw new Error('削除に失敗しました');

      setEntries((prev) => prev.filter((entry) => entry.SK !== sk));
      
      if (randomEntry?.SK === sk) {
        setRandomEntry(null);
      }

      setStatus('記憶を削除しました');
      setTimeout(() => setStatus(''), 3000);
    } catch (err: any) {
      console.error('Delete error:', err);
      setStatus(`削除エラー: ${err.message}`);
    }
  };

  const formatDate = (skValue?: string, createdAt?: string) => {
    const dateStr = createdAt || (skValue?.startsWith('ENTRY#') ? Number(skValue.replace('ENTRY#', '')) : null);
    const date = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(date.getTime())) return 'UNKNOWN DATE';
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).replace(/\//g, '.');
  };

  const allTags = Array.from(
    new Set(['all', ...entries.flatMap((e) => e.tags || [])])
  );

  const filteredEntries = selectedTag === 'all'
    ? entries
    : entries.filter((e) => e.tags?.includes(selectedTag));

  return (
    <div className="min-h-screen bg-[#F6F5F2] text-zinc-800 font-sans pb-24 selection:bg-zinc-200">
      
      {/* Header */}
      <header className="max-w-xl mx-auto px-6 pt-10 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-zinc-900 font-serif">tokii</h1>
          <p className="text-[10px] text-zinc-400 tracking-wider uppercase mt-0.5">archiving moments</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-zinc-900 text-zinc-100 text-xs font-medium rounded-full hover:bg-zinc-800 active:scale-95 transition-all flex items-center space-x-2 shadow-sm cursor-pointer"
        >
          <PenIcon />
          <span>時を留める</span>
        </button>
      </header>

      <main className="max-w-xl mx-auto px-4 space-y-6">

        {/* 投稿フォーム */}
        {showForm && (
          <section className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-zinc-200/80 shadow-sm space-y-4 transition-all">
            <div className="flex justify-between items-center">
              <h2 className="text-[11px] font-medium text-zinc-400 tracking-wider uppercase">New Moment</h2>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-700">
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="言葉を残す..."
                rows={3}
                className="w-full p-4 bg-zinc-50/50 border border-zinc-200/80 rounded-2xl focus:outline-none focus:ring-1 focus:ring-zinc-400 text-sm placeholder:text-zinc-400 resize-none transition-all"
              />
              
              <div className="space-y-2">
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="タグ (例: 感謝, 読書 - カンマ区切り)"
                  className="w-full px-3.5 py-2.5 bg-zinc-50/50 border border-zinc-200/80 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400 placeholder:text-zinc-400"
                />

                {/* 既存タグバッジ */}
                {allTags.filter((t) => t !== 'all').length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center pt-1">
                    <span className="text-[10px] text-zinc-400 mr-1">既存タグ:</span>
                    {allTags.filter((t) => t !== 'all').map((t) => {
                      const currentTagArray = tags ? tags.split(',').map((s) => s.trim()).filter(Boolean) : [];
                      const isSelected = currentTagArray.includes(t);
                      
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              const newTags = currentTagArray.filter((item) => item !== t);
                              setTags(newTags.join(', '));
                            } else {
                              setTags([...currentTagArray, t].join(', '));
                            }
                          }}
                          className={`text-[11px] px-2.5 py-0.5 rounded-full transition-all cursor-pointer border ${
                            isSelected 
                              ? 'bg-zinc-800 text-zinc-100 border-zinc-800' 
                              : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200/60'
                          }`}
                        >
                          #{t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 画像選択 */}
              <div className="flex items-center space-x-3">
                <label className="cursor-pointer inline-flex items-center space-x-1.5 text-xs text-zinc-500 bg-zinc-100 px-3 py-2 rounded-xl hover:bg-zinc-200/60 transition">
                  <span>画像を選択</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                {imagePreview && (
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-zinc-200">
                    <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-zinc-100">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-zinc-900 text-zinc-100 text-xs font-medium rounded-xl hover:bg-zinc-800 active:scale-95 transition cursor-pointer"
                >
                  {isSubmitting ? '保存中...' : '記録する'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ステータス */}
        {status && (
          <div className="text-center text-xs text-zinc-400 transition-all font-mono">
            {status}
          </div>
        )}

        {/* 1. あの日の tokii（Flashback） */}
        <section className="bg-white p-6 sm:p-7 rounded-3xl border border-zinc-200/70 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-800 inline-block"></span>
              <h2 className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Flashback</h2>
            </div>
            <button
              onClick={handleFetchRandom}
              className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center space-x-1.5 transition cursor-pointer"
            >
              <RefreshIcon />
              <span>別の時</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 text-xs text-zinc-400">
            <span>Filter:</span>
            <select
              value={randomTag}
              onChange={(e) => setRandomTag(e.target.value)}
              className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-zinc-600 focus:outline-none"
            >
              {allTags.map((t) => (
                <option key={t} value={t}>{t === 'all' ? 'すべて' : `#${t}`}</option>
              ))}
            </select>
          </div>

          {randomEntry ? (
            <div className="space-y-3 pt-1">
              {randomEntry.imageUrl && (
                <div className="rounded-2xl overflow-hidden max-h-72 border border-zinc-100">
                  <img src={randomEntry.imageUrl} alt="Memory" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono tracking-tight">
                <span>{formatDate(randomEntry.SK, randomEntry.created_at)}</span>
                <button 
                  onClick={() => handleDeleteEntry(randomEntry.PK, randomEntry.SK)}
                  className="text-zinc-300 hover:text-rose-500 transition cursor-pointer p-1" 
                  title="削除"
                >
                  <TrashIcon />
                </button>
              </div>
              {randomEntry.tags && randomEntry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {randomEntry.tags.map((t) => (
                    <span key={t} className="text-[10px] bg-zinc-100 text-zinc-600 border border-zinc-200/60 px-2 py-0.5 rounded-full">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-sm text-zinc-700 leading-relaxed font-serif pt-0.5">
                {randomEntry.content}
              </p>
            </div>
          ) : (
            <div className="text-center py-10 text-zinc-400 text-xs">
              記憶が見つかりませんでした
            </div>
          )}
        </section>

        {/* 2. 重なる記憶（アコーディオン） */}
        <section className="space-y-4 pt-2">
          <div className="flex justify-center">
            <button
              onClick={handleToggleTimeline}
              className="px-5 py-2 bg-white/80 backdrop-blur-sm border border-zinc-200/80 rounded-full text-xs text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 transition-all flex items-center space-x-2 shadow-xs cursor-pointer active:scale-95"
            >
              <LayersIcon />
              <span>{isTimelineOpen ? '重なる記憶を閉じる' : '重なる記憶を覗く'}</span>
              <span className="text-[10px] text-zinc-400">{isTimelineOpen ? '▲' : '▼'}</span>
            </button>
          </div>

          {isTimelineOpen && (
            <div className="space-y-4 pt-2 transition-all">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-[11px] font-medium text-zinc-400 tracking-wider uppercase">Timeline (Latest 10)</h2>
                <span className="text-[11px] font-mono text-zinc-400">{filteredEntries.length} items</span>
              </div>

              {/* タグフィルター */}
              {allTags.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {allTags.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTag(t)}
                      className={`px-3 py-1 rounded-full text-[11px] transition-all whitespace-nowrap cursor-pointer border ${
                        selectedTag === t
                          ? 'bg-zinc-800 text-zinc-100 border-zinc-800'
                          : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {t === 'all' ? 'すべて' : `#${t}`}
                    </button>
                  ))}
                </div>
              )}

              {/* 記憶カード一覧 */}
              <div className="space-y-3.5">
                {filteredEntries.length > 0 ? (
                  filteredEntries.map((entry) => (
                    <div key={entry.SK} className="bg-white p-5 rounded-2xl border border-zinc-200/70 shadow-[0_1px_8px_-2px_rgba(0,0,0,0.02)] space-y-3">
                      {entry.imageUrl && (
                        <div className="rounded-xl overflow-hidden max-h-56 border border-zinc-100">
                          <img src={entry.imageUrl} alt="Memory item" className="w-full h-full object-cover" />
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                        <span>{formatDate(entry.SK, entry.created_at)}</span>
                        <button 
                          onClick={() => handleDeleteEntry(entry.PK, entry.SK)}
                          className="text-zinc-300 hover:text-rose-500 transition cursor-pointer p-1" 
                          title="削除"
                        >
                          <TrashIcon />
                        </button>
                      </div>

                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {entry.tags.map((t) => (
                            <span key={t} className="text-[10px] bg-zinc-100 text-zinc-600 border border-zinc-200/60 px-2 py-0.5 rounded-full">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-sm text-zinc-700 leading-relaxed font-serif">
                        {entry.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-zinc-400">
                    表示できる記憶がありません
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}