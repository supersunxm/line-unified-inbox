"use client";

import { useEffect, useMemo, useState } from "react";
import { richMessageApi, type RichMessage, type RichMessageAction } from "./rich-message-api";

type ActionPatch = Omit<Partial<RichMessageAction>, "area"> & {
  area?: Partial<RichMessageAction["area"]>;
};

const blankAction = (height = 1040): RichMessageAction => ({
  id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  type: "URI",
  value: "https://",
  area: { x: 0, y: 0, width: 1040, height },
});

export function RichMessagesView() {
  const [items, setItems] = useState<RichMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [altText, setAltText] = useState("แตะเพื่อดูรายละเอียด");
  const [mediaObjectKey, setMediaObjectKey] = useState("");
  const [previewObjectKey, setPreviewObjectKey] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [baseHeight, setBaseHeight] = useState(1040);
  const [actions, setActions] = useState<RichMessageAction[]>([blankAction()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );

  const load = async () => {
    setLoading(true);
    try {
      setItems(await richMessageApi.list(true));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "โหลด Rich Message ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const reset = () => {
    setSelectedId(null);
    setName("");
    setDescription("");
    setAltText("แตะเพื่อดูรายละเอียด");
    setMediaObjectKey("");
    setPreviewObjectKey("");
    setPreviewUrl("");
    setBaseHeight(1040);
    setActions([blankAction()]);
    setError(null);
    setSuccess(null);
  };

  const select = (item: RichMessage) => {
    setSelectedId(item.id);
    setName(item.name);
    setDescription(item.description || "");
    setAltText(item.altText);
    setMediaObjectKey(item.mediaObjectKey);
    setPreviewObjectKey(item.previewObjectKey || "");
    setPreviewUrl(item.previewUrl || item.imageUrl);
    setBaseHeight(item.baseHeight);
    setActions(item.actions.length ? item.actions : [blankAction(item.baseHeight)]);
    setError(null);
    setSuccess(null);
  };

  const updateAction = (index: number, patch: ActionPatch) => {
    setActions((previous) => previous.map((action, i) => i !== index ? action : {
      ...action,
      ...patch,
      area: { ...action.area, ...(patch.area || {}) },
    }));
  };

  const handleImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await richMessageApi.uploadImage(file);
      setMediaObjectKey(result.mediaObjectKey);
      setPreviewObjectKey(result.previewObjectKey);
      setPreviewUrl(result.previewUrl || result.imageUrl);
      if (result.width && result.height) {
        const nextHeight = Math.min(1040, Math.max(1, Math.round((result.height / result.width) * 1040)));
        setBaseHeight(nextHeight);
        setActions((current) => current.length === 1
          ? [{ ...current[0], area: { x: 0, y: 0, width: 1040, height: nextHeight } }]
          : current);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim() || !altText.trim() || !mediaObjectKey) {
      setError("กรอกชื่อ Alt text และอัปโหลดรูปให้ครบ");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        altText: altText.trim(),
        mediaObjectKey,
        previewObjectKey: previewObjectKey || undefined,
        baseWidth: 1040,
        baseHeight,
        actions,
      };
      const saved = selectedId
        ? await richMessageApi.update(selectedId, payload)
        : await richMessageApi.create(payload);
      await load();
      select(saved);
      setSuccess(selectedId ? "บันทึก Rich Message แล้ว" : "สร้าง Rich Message แล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึก Rich Message ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--app-bg)] p-6 text-[var(--app-text-primary)]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--app-text-secondary)]">LINE OA</div>
            <h1 className="text-2xl font-semibold">Rich Message</h1>
            <p className="mt-1 text-sm text-[var(--app-text-secondary)]">สร้างครั้งเดียว แล้วนำกลับไปใช้ใน Greeting Message ได้หลายเทมเพลต</p>
          </div>
          <div className="flex gap-2">
            <a href="/greeting-messages" className="rounded-lg border border-[var(--app-border)] bg-white px-4 py-2 text-sm">← Greeting Message</a>
            <button type="button" onClick={reset} className="rounded-lg bg-[#06c755] px-4 py-2 text-sm font-semibold text-white">+ สร้างใหม่</button>
          </div>
        </header>

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-[var(--app-border)] bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="font-semibold">คลัง Rich Message</h2>
              <span className="text-xs text-gray-500">{items.length}</span>
            </div>
            {loading ? <div className="p-4 text-sm text-gray-500">กำลังโหลด…</div> : (
              <div className="space-y-2">
                {items.map((item) => (
                  <button key={item.id} type="button" onClick={() => select(item)} className={`w-full rounded-lg border p-2 text-left ${selectedId === item.id ? "border-[#06c755] bg-emerald-50" : "border-gray-200 hover:bg-gray-50"}`}>
                    <div className="flex gap-3">
                      <img src={item.previewUrl || item.imageUrl} alt="" className="h-16 w-16 rounded-md border object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{item.name}</div>
                        <div className="mt-1 text-xs text-gray-500">{item.actions.length} จุดกด · {item.baseWidth}×{item.baseHeight}</div>
                        <div className={`mt-1 text-xs font-medium ${item.isActive ? "text-emerald-600" : "text-gray-400"}`}>{item.isActive ? "ใช้งานได้" : "ปิดใช้งาน"}</div>
                      </div>
                    </div>
                  </button>
                ))}
                {!items.length && <div className="p-4 text-center text-sm text-gray-500">ยังไม่มี Rich Message</div>}
              </div>
            )}
          </aside>

          <section className="rounded-xl border border-[var(--app-border)] bg-white p-5 shadow-sm">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium">ชื่อ Rich Message<input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น A7 Pro Promotion" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-[#06c755]" /></label>
                  <label className="text-sm font-medium">Alt text<input value={altText} maxLength={400} onChange={(e) => setAltText(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-[#06c755]" /></label>
                </div>
                <label className="block text-sm font-medium">คำอธิบาย<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-[#06c755]" /></label>

                <div>
                  <div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium">รูป Rich Message</span><span className="text-xs text-gray-500">ฐานกว้าง 1040 px</span></div>
                  <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-600 hover:border-[#06c755]">
                    {uploading ? "กำลังอัปโหลด…" : previewUrl ? "เปลี่ยนรูป" : "อัปโหลด JPG / PNG"}
                    <input type="file" accept="image/jpeg,image/png" className="hidden" disabled={uploading} onChange={(e) => void handleImage(e.target.files?.[0])} />
                  </label>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div><h3 className="text-sm font-semibold">พื้นที่กด</h3><p className="text-xs text-gray-500">URI = เปิดลิงก์, MESSAGE = ส่งข้อความกลับเข้าแชท</p></div>
                    <button type="button" onClick={() => setActions((current) => [...current, blankAction(baseHeight)])} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium">+ เพิ่มพื้นที่</button>
                  </div>
                  <div className="space-y-3">
                    {actions.map((action, index) => (
                      <div key={action.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold">พื้นที่ {index + 1}</span><button type="button" disabled={actions.length === 1} onClick={() => setActions((current) => current.filter((_, i) => i !== index))} className="text-xs text-red-600 disabled:opacity-30">ลบ</button></div>
                        <div className="grid gap-2 md:grid-cols-[130px_minmax(0,1fr)]">
                          <select value={action.type} onChange={(e) => updateAction(index, { type: e.target.value as "URI" | "MESSAGE" })} className="rounded-lg border border-gray-300 px-2 py-2 text-sm"><option value="URI">URI</option><option value="MESSAGE">MESSAGE</option></select>
                          <input value={action.value} onChange={(e) => updateAction(index, { value: e.target.value })} placeholder={action.type === "URI" ? "https://..." : "ข้อความที่จะส่ง"} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {(["x", "y", "width", "height"] as const).map((key) => (
                            <label key={key} className="text-[11px] uppercase text-gray-500">{key}
                              <input type="number" min={key === "width" || key === "height" ? 1 : 0} value={action.area[key]} onChange={(e) => updateAction(index, { area: { [key]: Number(e.target.value) } })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-800" />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                  <button type="button" disabled={saving || uploading} onClick={() => void save()} className="rounded-lg bg-[#06c755] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "กำลังบันทึก…" : selectedId ? "บันทึกการแก้ไข" : "สร้าง Rich Message"}</button>
                  {selected && <button type="button" onClick={async () => { await richMessageApi.setActive(selected.id, !selected.isActive); await load(); }} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm">{selected.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</button>}
                </div>
              </div>

              <aside>
                <div className="sticky top-5 rounded-xl bg-[#eef1f4] p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Preview</div>
                  <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                    {previewUrl ? (
                      <div className="relative">
                        <img src={previewUrl} alt={altText} className="block w-full" />
                        {actions.map((action, index) => (
                          <div key={action.id} className="pointer-events-none absolute border-2 border-[#06c755]/70 bg-[#06c755]/10 text-[10px] font-bold text-[#087f3b]" style={{ left: `${action.area.x / 10.4}%`, top: `${action.area.y / baseHeight * 100}%`, width: `${action.area.width / 10.4}%`, height: `${action.area.height / baseHeight * 100}%` }}>
                            <span className="bg-white/90 px-1">{index + 1}</span>
                          </div>
                        ))}
                      </div>
                    ) : <div className="flex aspect-square items-center justify-center text-sm text-gray-400">อัปโหลดรูปเพื่อดูตัวอย่าง</div>}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-gray-500">LINE จะโหลดรูปตามขนาดอุปกรณ์อัตโนมัติ ระบบสร้าง 240 / 300 / 460 / 700 / 1040 px จากไฟล์ต้นฉบับเดียว</p>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
