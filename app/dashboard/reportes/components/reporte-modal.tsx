"use client";

import { ReactNode, useRef, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ZoomIn, ZoomOut, Maximize2, Maximize } from "lucide-react";

interface ReporteModalProps {
    isOpen: boolean;
    onClose: () => void;
    titulo: string;
    children: ReactNode;
}

export function ReporteModal({ isOpen, onClose, titulo, children }: ReporteModalProps) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  type ViewMode = 'fit-width' | 'fit-height' | 'manual' | 'actual';
  const [viewMode, setViewMode] = useState<ViewMode>('fit-width');

  const clampScale = (value: number) => Math.min(1, Math.max(0.2, value));

  const resolvePrintableNode = () => {
    const inner = innerRef.current;
    if (!inner) return null;
    const explicit = inner.querySelector<HTMLElement>("[data-print-root]");
    if (explicit) return explicit as HTMLDivElement;
    const firstChild = inner.firstElementChild;
    if (firstChild instanceof HTMLDivElement) return firstChild;
    return inner;
  };

  const ensurePrintableRef = () => {
    const node = resolvePrintableNode();
    if (!node) return null;
    if (pageRef.current !== node) {
      pageRef.current = node;
    }
    if (!node.dataset.modalPrintNode) {
      node.dataset.modalPrintNode = "true";
    }
    node.style.transformOrigin = "top center";
    return node;
  };

    useEffect(() => {
    if (!isOpen) return;
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;

    const page = ensurePrintableRef();
    if (!page) return;

    const updateScale = () => {
      const wrapperEl = wrapperRef.current;
      const target = pageRef.current;
      if (!wrapperEl || !target) return;

      const previousTransform = target.style.transform;
      target.style.transform = "scale(1)";

      const wrapperRect = wrapperEl.getBoundingClientRect();
      const pageRect = target.getBoundingClientRect();
      const offsetTop = pageRect.top - wrapperRect.top;
      const availableWidth = wrapperRect.width;
      const availableHeight = wrapperRect.height - offsetTop;

      if (viewMode === 'manual') {
        target.style.transform = previousTransform;
        return;
      }

      if (availableWidth <= 0 || availableHeight <= 0) {
        target.style.transform = previousTransform;
        return;
      }

      let nextScale = 1;
      if (viewMode === 'fit-width') {
        nextScale = Math.min(1, availableWidth / Math.max(1, pageRect.width));
      } else if (viewMode === 'fit-height') {
        nextScale = Math.min(1, availableHeight / Math.max(1, pageRect.height));
      } else if (viewMode === 'actual') {
        nextScale = 1;
      }

      const normalized = Number.isFinite(nextScale) ? nextScale : 1;
      target.style.transform = `scale(${normalized})`;
      target.style.transformOrigin = "top center";
      setScale(normalized);
    };

    updateScale();

    const onResize = () => updateScale();
    window.addEventListener("resize", onResize);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateScale()) : null;
    observer?.observe(page);

    return () => {
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
      if (pageRef.current === page) {
        delete page.dataset.modalPrintNode;
        pageRef.current.style.transform = "";
        pageRef.current = null;
      }
    };
  }, [isOpen, children, viewMode]);

  useEffect(() => {
    if (viewMode !== 'manual') return;
    const target = pageRef.current ?? ensurePrintableRef();
    if (!target) return;
    const manual = clampScale(scale);
    if (manual !== scale) {
      setScale(manual);
      return;
    }
    target.style.transform = `scale(${manual})`;
    target.style.transformOrigin = "top center";
  }, [scale, viewMode]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-full h-[95vh] max-h-[95vh] p-0 gap-0 [&>button]:hidden overflow-hidden flex flex-col">
                {/* Header fijo */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-white dark:bg-slate-950 shrink-0 print-hidden">
                    <DialogTitle className="text-lg font-semibold">{titulo}</DialogTitle>
          <div className="flex gap-2 items-center">
            {/* Controles de zoom (solo vista, no afectan impresion) */}
            <div className="hidden md:flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => { setViewMode('manual'); setScale((s) => clampScale(s - 0.1)); }} title="Zoom -">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setViewMode('manual'); setScale((s) => clampScale(s + 0.1)); }} title="Zoom +">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setViewMode('fit-width')} title="Ajustar ancho">
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setViewMode('fit-height')} title="Ajustar alto">
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
                        <Button variant="ghost" size="sm" onClick={onClose} className="h-9 w-9 p-0">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

        {/* Contenido scrolleable imprimible A4 */}
        <div className="flex-1 overflow-auto p-5 bg-slate-50 dark:bg-slate-900">
          <div ref={wrapperRef} className="relative flex h-full w-full overflow-auto">
            <div ref={innerRef} className="mx-auto flex min-w-0 items-start justify-center">
              {children}
            </div>
          </div>
        </div>
            </DialogContent>
        </Dialog>
    );
}
