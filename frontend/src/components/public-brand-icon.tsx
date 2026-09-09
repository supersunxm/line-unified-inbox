import Image from "next/image";

export function PublicBrandIcon() {
  return (
    <Image
      src="/images/LOGO_OBS.png"
      alt=""
      width={32}
      height={32}
      priority
      aria-hidden="true"
      className="h-6 w-6 shrink-0 rounded-md object-contain sm:h-7 sm:w-7"
    />
  );
}
