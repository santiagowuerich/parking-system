import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
    className?: string;
    width?: number;
    height?: number;
    priority?: boolean;
    onClick?: () => void;
}

export function Logo({
    className,
    width = 150,
    height = 40,
    priority = false,
    onClick
}: LogoProps) {
    return (
        <div
            className={cn("relative flex items-center", className, onClick && "cursor-pointer")}
            onClick={onClick}
        >
            <Image
                src="/logo2.png"
                alt="Parqueo Logo"
                width={width}
                height={height}
                priority={priority}
                className="object-contain"
            />
        </div>
    );
}
