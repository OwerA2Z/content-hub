export const markClass = "grid size-[30px] place-items-center rounded-[10px] bg-brand font-black text-brand-deep";
export const eyebrowClass = "m-0 text-[10px] font-extrabold tracking-[.16em] text-[#73907f]";
export const panelClass = "rounded-[18px] border border-border-soft bg-white p-6";
export const primaryClass = "cursor-pointer rounded-[9px] border-0 bg-brand px-3.5 py-[9px] font-bold text-[#1d3027]";
export const secondaryClass = "cursor-pointer rounded-[9px] border-0 bg-[#edf4e8] px-3.5 py-[9px] text-[#305046]";
export const inputClass = "rounded-[9px] border border-[#dce6dc] bg-[#fbfdf9] px-3 py-2.5 text-[#52645b] outline-none focus:border-[#81aa65] focus:ring-3 focus:ring-[#e7f1df]";

export function Stat({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <div className="rounded-2xl border border-border-soft bg-white p-[22px]"><span className="block text-[12px] text-[#76877f]">{label}</span><strong className="my-3 block text-[30px] tracking-[-.05em]">{value}</strong><small className="block text-[12px] text-[#76877f]">{hint}</small></div>;
}
