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

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [randomEntry, setRandomEntry] = useState<Entry | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>('すべて');
  const [randomTag, setRandomTag] = useState<string>('すべて');
  
  // タイムライン開閉 & ロード状態
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [hasLoadedTimeline, setHasLoadedTimeline] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  // 投稿フォーム状態
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 初期化：初回ランダムピックのみ実行
  useEffect(() => {
    fetchRandomInitial();
  }, []);

  const fetchRandomInitial = async () => {
    try {
      const res = await fetch(`${API_URL}/entries/random`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        setRandomEntry(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 「重なる記憶を覗く」ボタンのトグル処理（開く時に初回ロード）
  const handleToggleTimeline = async () => {
    if (!isTimelineOpen && !hasLoadedTimeline) {
      await fetchLatestEntries();
    }
    setIsTimelineOpen((prev) => !prev);
  };

  // 最新10件を取得する関数
  const fetchLatestEntries = async () => {
    try {
      setIsLoadingTimeline(true);
      const res = await fetch(`${API_URL}/entries`, { cache: 'no-store' });
      if (!res.ok) throw new Error('一覧の取得に失敗しました');

      const data = await res.json();
      if (Array.isArray(data)) {
        setEntries(data);
        setHasLoadedTimeline(true);
      }
    } catch (err) {
      console.error('Timeline load error:', err);
      setStatus('❌ 記憶の一覧の読み込みに失敗しました');
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  // タグ絞り込みを考慮したランダム取得
  const handleFetchRandom = async () => {
    try {
      setStatus('過去の記憶を呼び起こしています...');
      
      const res = await fetch(`${API_URL}/entries/random`, { cache: 'no-store' });
      if (!res.ok) throw new Error('記憶が見つかりませんでした');

      const data = await res.json();
      if (data) {
        // タイムライン一覧に未追加なら統合
        setEntries((prev) => (prev.some((item) => item.SK === data.SK) ? prev : [data, ...prev]));
        
        const targetEntries = randomTag === 'すべて' 
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

  // 画像選択
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // 投稿処理（S3直アップロード＋DynamoDB保存）
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

      // タイムラインの先頭に追加（最大10件を維持）
      setEntries((prev) => [createdItem, ...prev].slice(0, 10));
      setRandomEntry(createdItem);

      setStatus('✨ 記憶が刻まれました');
      setContent('');
      setTags('');
      setImageFile(null);
      setImagePreview(null);
      setShowForm(false);
    } catch (err: any) {
      console.error('Error in handleCreateEntry:', err);
      setStatus(`❌ ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 思い出削除処理
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

      setStatus('🗑️ 記憶が削除されました');
      setTimeout(() => setStatus(''), 3000);
    } catch (err: any) {
      console.error('Delete error:', err);
      setStatus(`❌ 削除エラー: ${err.message}`);
    }
  };

  const formatDate = (skValue?: string, createdAt?: string) => {
    const dateStr = createdAt || (skValue?.startsWith('ENTRY#') ? Number(skValue.replace('ENTRY#', '')) : null);
    const date = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(date.getTime())) return '日付不明';
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  // タグ一覧抽出
  const allTags = Array.from(
    new Set(['すべて', ...entries.flatMap((e) => e.tags || [])])
  );

  // フィルタリングされた一覧
  const filteredEntries = selectedTag === 'すべて'
    ? entries
    : entries.filter((e) => e.tags?.includes(selectedTag));

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-neutral-800 font-sans pb-20">
      
      {/* ナビゲーションヘッダー */}
      <header className="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-baseline space-x-3">
          <h1 className="text-2xl font-serif text-neutral-900 tracking-wider">tokii</h1>
          <span className="text-xs text-neutral-400 font-light">時を解き、残す</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#2a2a2a] text-white text-xs rounded-full hover:bg-black transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer"
        >
          <span>🖊</span>
          <span>時を認める</span>
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 space-y-8">

        {/* 投稿フォーム（開閉式） */}
        {showForm && (
          <section className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-sm space-y-4 animate-fade-in">
            <h2 className="text-xs font-medium text-neutral-400 tracking-widest uppercase">新しい時を留める</h2>
            <form onSubmit={handleCreateEntry} className="space-y-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="近所の喫茶店でゆっくり読書..."
                rows={3}
                className="w-full p-4 bg-[#fcfbf9] border border-neutral-200 rounded-2xl focus:outline-none focus:border-neutral-400 text-sm placeholder:text-neutral-300 resize-none"
              />
              
              <div className="space-y-2">
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="タグ (例: 感謝, うれしい - カンマ区切り)"
                  className="w-full p-3 bg-[#fcfbf9] border border-neutral-200 rounded-xl text-xs focus:outline-none"
                />

                {/* 登録済みタグからのクイック選択バッジ */}
                {allTags.filter((t) => t !== 'すべて').length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center pt-1">
                    <span className="text-[10px] text-neutral-400 mr-1">既存タグから選ぶ:</span>
                    {allTags.filter((t) => t !== 'すべて').map((t) => {
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
                          className={`text-[11px] px-2.5 py-0.5 rounded-md transition cursor-pointer border ${
                            isSelected 
                              ? 'bg-[#2a2a2a] text-white border-[#2a2a2a]' 
                              : 'bg-[#f4f2eb] text-amber-800 border-amber-200/60 hover:bg-amber-100'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="p-2 bg-[#fcfbf9] border border-neutral-200 rounded-xl text-xs text-neutral-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:bg-neutral-200"
                />
              </div>

              {imagePreview && (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border">
                  <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-xs text-neutral-500 hover:text-neutral-800 cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#2a2a2a] text-white text-xs rounded-xl hover:bg-black transition cursor-pointer"
                >
                  {isSubmitting ? '保存中...' : '記録する'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ステータス表示 */}
        {status && (
          <div className="text-center text-xs text-neutral-500 animate-pulse">
            {status}
          </div>
        )}

        {/* 1. あの日の tokii（ランダム振り返りセクション） */}
        <section className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-600 inline-block"></span>
              <h2 className="text-sm font-serif text-neutral-800 font-medium">あの日の tokii</h2>
            </div>
            <button
              onClick={handleFetchRandom}
              className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center space-x-1 transition cursor-pointer"
            >
              <span>🔄</span>
              <span>別の時をひらく</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 text-xs text-neutral-500 pt-1">
            <span>タグ絞り込み:</span>
            <select
              value={randomTag}
              onChange={(e) => setRandomTag(e.target.value)}
              className="bg-[#f7f6f2] border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none"
            >
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {randomEntry ? (
            <div className="space-y-3 pt-2">
              {randomEntry.imageUrl && (
                <div className="rounded-2xl overflow-hidden max-h-72 border border-neutral-100">
                  <img src={randomEntry.imageUrl} alt="Memory" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-neutral-400 font-serif">
                <span>{formatDate(randomEntry.SK, randomEntry.created_at)}</span>
                <button 
                  onClick={() => handleDeleteEntry(randomEntry.PK, randomEntry.SK)}
                  className="hover:text-red-500 transition cursor-pointer" 
                  title="削除"
                >
                  🗑️
                </button>
              </div>
              {randomEntry.tags && randomEntry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {randomEntry.tags.map((t) => (
                    <span key={t} className="text-[11px] bg-[#f4f2eb] text-amber-800 border border-amber-200/60 px-2.5 py-0.5 rounded-md">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-sm text-neutral-700 leading-relaxed font-serif pt-1">
                {randomEntry.content}
              </p>
            </div>
          ) : (
            <div className="text-center py-10 text-neutral-400 text-xs font-serif">
              該当するタグの記憶がありません
            </div>
          )}
        </section>

        {/* 2. 重なる記憶（アコーディオン式タイムライン） */}
        <section className="space-y-4 pt-4 border-t border-neutral-200/60">
          {/* トリガーボタン */}
          <div className="flex justify-center">
            <button
              onClick={handleToggleTimeline}
              className="px-6 py-2.5 bg-white border border-neutral-300 rounded-full text-xs text-neutral-700 hover:bg-neutral-50 transition-all flex items-center space-x-2 shadow-sm cursor-pointer"
            >
              <span>{isTimelineOpen ? '📖 重なる記憶を閉じる' : '📖 重なる記憶を覗く'}</span>
              <span className="text-[10px] text-neutral-400">
                {isTimelineOpen ? '▲' : '▼'}
              </span>
            </button>
          </div>

          {/* ローディング表示 */}
          {isLoadingTimeline && (
            <div className="text-center text-xs text-neutral-400 py-6 animate-pulse font-serif">
              刻まれた記憶を手繰り寄せています...
            </div>
          )}

          {/* 折りたたみコンテンツ */}
          {isTimelineOpen && !isLoadingTimeline && (
            <div className="space-y-4 animate-fade-in pt-2">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xs font-serif text-neutral-500">最新の記憶 (最大10件)</h2>
                <span className="text-xs text-neutral-400">{filteredEntries.length} 件</span>
              </div>

              {/* タグフィルターボタン群 */}
              {allTags.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {allTags.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTag(t)}
                      className={`px-3.5 py-1.5 rounded-full text-xs transition-colors whitespace-nowrap cursor-pointer ${
                        selectedTag === t
                          ? 'bg-[#2a2a2a] text-white'
                          : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              {/* 記憶カード一覧 */}
              <div className="space-y-4">
                {filteredEntries.length > 0 ? (
                  filteredEntries.map((entry) => (
                    <div key={entry.SK} className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-sm space-y-3">
                      {entry.imageUrl && (
                        <div className="rounded-2xl overflow-hidden max-h-64 border border-neutral-100">
                          <img src={entry.imageUrl} alt="Memory item" className="w-full h-full object-cover" />
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-xs text-neutral-400 font-serif">
                        <span>{formatDate(entry.SK, entry.created_at)}</span>
                        <button 
                          onClick={() => handleDeleteEntry(entry.PK, entry.SK)}
                          className="hover:text-red-500 transition cursor-pointer" 
                          title="削除"
                        >
                          🗑️
                        </button>
                      </div>

                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {entry.tags.map((t) => (
                            <span key={t} className="text-[11px] bg-[#f4f2eb] text-amber-800 border border-amber-200/60 px-2.5 py-0.5 rounded-md">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-sm text-neutral-700 leading-relaxed font-serif">
                        {entry.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-neutral-400 font-serif">
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