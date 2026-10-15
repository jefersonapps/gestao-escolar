import React, { useState, useRef, useEffect } from 'react';
import type { CertificateField, CertificateTemplate, CertificateStudentData } from '@/types/certificates';
import { replacePlaceholders } from '@/services/certificatePdfGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Trash2, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Bold, 
  Italic, 
  Type, 
  Eye, 
  Edit3,
  Move,
  Sparkles,
  User,
  Trophy,
  GraduationCap,
  FileText,
  BookOpen,
  Calculator,
  BookmarkCheck,
  Calendar,
  Award
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';

interface CertificateEditorCanvasProps {
  template: CertificateTemplate;
  onChangeTemplate: (updated: CertificateTemplate) => void;
  sampleStudent?: CertificateStudentData;
}

const SAMPLE_STUDENT_DEFAULT: CertificateStudentData = {
  id: 'sample-1',
  nome_aluno: 'MARIA EDUARDA SILVA',
  turma: '5º ANO A',
  escola: 'Escola Municipal Monteiro Lobato',
  colocacao: '1º Lugar Geral',
  avaliacao: '2026 - Avaliação Formativa 1',
  nota_portugues: '95%',
  nota_matematica: '98%',
  nivel_leitura: 'Fluente',
  data: new Date().toLocaleDateString('pt-BR'),
  texto_personalizado: 'Pelo excelente desempenho e dedicação nos estudos.',
};

const VARIABLE_BADGES = [
  { key: '{nome_aluno}', label: 'Nome do Aluno', Icon: User, defaultText: '{nome_aluno}' },
  { key: '{colocacao}', label: 'Colocação (1º, 2º...)', Icon: Trophy, defaultText: 'em {colocacao}' },
  { key: '{turma}', label: 'Turma / Série', Icon: GraduationCap, defaultText: '{turma}' },
  { key: '{avaliacao}', label: 'Avaliação', Icon: FileText, defaultText: 'no(a) {avaliacao}' },
  { key: '{nota_portugues}', label: '% Português', Icon: BookOpen, defaultText: 'Português: {nota_portugues}' },
  { key: '{nota_matematica}', label: '% Matemática', Icon: Calculator, defaultText: 'Matemática: {nota_matematica}' },
  { key: '{nivel_leitura}', label: 'Fluência Leitora', Icon: BookmarkCheck, defaultText: 'Leitura: {nivel_leitura}' },
  { key: '{data}', label: 'Data Atual', Icon: Calendar, defaultText: 'Data: {data}' },
];

export const CertificateEditorCanvas: React.FC<CertificateEditorCanvasProps> = ({
  template,
  onChangeTemplate,
  sampleStudent = SAMPLE_STUDENT_DEFAULT,
}) => {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState<boolean>(false);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [containerWidth, setContainerWidth] = useState<number>(840);

  // Resize State for lateral & corner drag handles
  const [resizingState, setResizingState] = useState<{
    fieldId: string;
    handle: 'e' | 'w' | 's' | 'se';
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startXPercent: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const selectedField = template.fields.find((f) => f.id === selectedFieldId);

  // Measure container width for 100% pixel-perfect font scaling with PDF
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.getBoundingClientRect().width);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Helper to add a new text field
  const handleAddField = (presetText: string = 'Novo Texto', placeholderKey: string = '') => {
    const newId = `field_${Date.now()}`;
    const newField: CertificateField = {
      id: newId,
      name: placeholderKey ? VARIABLE_BADGES.find(b => b.key === placeholderKey)?.label || 'Campo' : 'Texto Personalizado',
      placeholderKey,
      xPercent: 15,
      yPercent: 35 + (template.fields.length * 8) % 40,
      widthPercent: 70,
      heightPercent: 10,
      text: presetText,
      fontSize: 22,
      fontFamily: 'helvetica',
      fontWeight: 'bold',
      color: '#1e293b',
      align: 'center',
    };

    onChangeTemplate({
      ...template,
      fields: [...template.fields, newField],
    });

    setSelectedFieldId(newId);
  };

  // Insert variable tag into selected field or create new one
  const handleInsertVariable = (badge: typeof VARIABLE_BADGES[0]) => {
    if (selectedFieldId) {
      const updatedFields = template.fields.map((f) => {
        if (f.id === selectedFieldId) {
          const currentText = f.text;
          const newText = currentText ? `${currentText} ${badge.key}` : badge.defaultText;
          return { ...f, text: newText, placeholderKey: badge.key };
        }
        return f;
      });
      onChangeTemplate({ ...template, fields: updatedFields });
    } else {
      handleAddField(badge.defaultText, badge.key);
    }
  };

  // Update selected field property
  const handleUpdateSelectedField = (updates: Partial<CertificateField>) => {
    if (!selectedFieldId) return;
    const updatedFields = template.fields.map((f) => (f.id === selectedFieldId ? { ...f, ...updates } : f));
    onChangeTemplate({ ...template, fields: updatedFields });
  };

  // Remove field
  const handleRemoveField = (id: string) => {
    const updatedFields = template.fields.filter((f) => f.id !== id);
    onChangeTemplate({ ...template, fields: updatedFields });
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
  };

  // Keyboard shortcut: Delete / Backspace key to remove selected field
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedFieldId || isPreview) return;
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);
      if (isInput) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleRemoveField(selectedFieldId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFieldId, isPreview, template]);

  // Dragging logic for repositioning
  const handleMouseDown = (e: React.MouseEvent, fieldId: string) => {
    if (isPreview || resizingState) return;
    e.stopPropagation();
    setSelectedFieldId(fieldId);
    setDraggingFieldId(fieldId);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const field = template.fields.find((f) => f.id === fieldId);
      if (field) {
        const fieldPixelX = (field.xPercent / 100) * rect.width;
        const fieldPixelY = (field.yPercent / 100) * rect.height;
        setDragOffset({
          x: clickX - fieldPixelX,
          y: clickY - fieldPixelY,
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingFieldId || !containerRef.current || resizingState) return;
    const rect = containerRef.current.getBoundingClientRect();

    const mouseX = e.clientX - rect.left - dragOffset.x;
    const mouseY = e.clientY - rect.top - dragOffset.y;

    let xPercent = Math.max(0, Math.min(90, (mouseX / rect.width) * 100));
    let yPercent = Math.max(0, Math.min(95, (mouseY / rect.height) * 100));

    // Snap to horizontal center if close to 15%
    if (Math.abs(xPercent - 15) < 2) xPercent = 15;

    const updatedFields = template.fields.map((f) =>
      f.id === draggingFieldId ? { ...f, xPercent: Math.round(xPercent * 10) / 10, yPercent: Math.round(yPercent * 10) / 10 } : f
    );

    onChangeTemplate({ ...template, fields: updatedFields });
  };

  const handleMouseUp = () => {
    setDraggingFieldId(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setDraggingFieldId(null);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Resize Drag Handler Start
  const handleResizeStart = (
    e: React.MouseEvent,
    fieldId: string,
    handle: 'e' | 'w' | 's' | 'se'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldId(fieldId);

    const field = template.fields.find((f) => f.id === fieldId);
    if (!field || !containerRef.current) return;

    setResizingState({
      fieldId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: field.widthPercent,
      startHeight: field.heightPercent || 10,
      startXPercent: field.xPercent,
    });
  };

  // Resize Drag Listener Effect
  useEffect(() => {
    if (!resizingState || !containerRef.current) return;

    const handleMouseMoveResize = (e: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const deltaX = ((e.clientX - resizingState.startX) / rect.width) * 100;
      const deltaY = ((e.clientY - resizingState.startY) / rect.height) * 100;

      const field = template.fields.find((f) => f.id === resizingState.fieldId);
      if (!field) return;

      let newWidth = resizingState.startWidth;
      let newHeight = resizingState.startHeight;
      let newX = resizingState.startXPercent;

      if (resizingState.handle === 'e' || resizingState.handle === 'se') {
        newWidth = Math.max(10, Math.min(100 - newX, resizingState.startWidth + deltaX));
      }
      if (resizingState.handle === 'w') {
        const maxRight = resizingState.startXPercent + resizingState.startWidth;
        newX = Math.max(0, Math.min(maxRight - 10, resizingState.startXPercent + deltaX));
        newWidth = Math.max(10, maxRight - newX);
      }
      if (resizingState.handle === 's' || resizingState.handle === 'se') {
        newHeight = Math.max(4, Math.min(100 - field.yPercent, resizingState.startHeight + deltaY));
      }

      const updatedFields = template.fields.map((f) =>
        f.id === resizingState.fieldId
          ? {
              ...f,
              xPercent: Math.round(newX * 10) / 10,
              widthPercent: Math.round(newWidth * 10) / 10,
              heightPercent: Math.round(newHeight * 10) / 10,
            }
          : f
      );
      onChangeTemplate({ ...template, fields: updatedFields });
    };

    const handleMouseUpResize = () => {
      setResizingState(null);
    };

    window.addEventListener('mousemove', handleMouseMoveResize);
    window.addEventListener('mouseup', handleMouseUpResize);
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveResize);
      window.removeEventListener('mouseup', handleMouseUpResize);
    };
  }, [resizingState, template, onChangeTemplate]);

  const isLandscape = template.orientation === 'landscape';

  return (
    <div className="space-y-4">
      {/* Top Action Bar & Variable Inserts */}
      <div className="bg-card border border-border rounded-lg p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Variáveis Dinâmicas (Clique para Inserir):</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isPreview ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsPreview(!isPreview)}
              className="gap-2"
            >
              {isPreview ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {isPreview ? 'Voltar para Edição' : 'Pré-visualizar com Exemplo'}
            </Button>

            <Button size="sm" onClick={() => handleAddField('Certificado', '')} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4" />
              Adicionar Caixa de Texto
            </Button>
          </div>
        </div>

        {/* Variable Badges */}
        <div className="flex flex-wrap gap-2">
          {VARIABLE_BADGES.map((badge) => {
            const IconComponent = badge.Icon;
            return (
              <Badge
                key={badge.key}
                variant="secondary"
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground border border-border py-1.5 px-2.5 transition-colors gap-1.5 text-xs bg-card"
                onClick={() => handleInsertVariable(badge)}
                title={`Inserir ${badge.label} no certificado`}
              >
                <IconComponent className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium text-foreground">{badge.label}</span>
                <Plus className="w-3 h-3 text-muted-foreground ml-0.5" />
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Main Canvas & Field Format Controls Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Visual Canvas Area */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center bg-muted/30 p-4 rounded-xl border border-border border-dashed relative overflow-hidden min-h-[420px]">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1 font-medium">
            <Move className="w-3.5 h-3.5" />
            <span>Arraste o centro ou as bordas laterais das caixas. Pressione <b>Delete</b> para excluir.</span>
          </div>

          {/* Certificate Board Container */}
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative w-full max-w-[840px] shadow-2xl rounded-lg overflow-hidden border border-border bg-white select-none transition-shadow"
            style={{
              aspectRatio: isLandscape ? '1.414 / 1' : '0.707 / 1', // A4 ratio
            }}
          >
            {/* Background Image or Template Pattern */}
            {template.bgImage && template.bgImage.startsWith('data:image') ? (
              <img
                src={template.bgImage}
                alt="Modelo de Certificado"
                className="w-full h-full object-cover absolute inset-0 pointer-events-none"
              />
            ) : (
              <div className="w-full h-full absolute inset-0 flex flex-col items-center justify-center bg-card border-[12px] border-primary/20 p-8 text-center pointer-events-none">
                <div className="w-full h-full border-2 border-dashed border-primary/20 flex flex-col items-center justify-center p-6 text-muted-foreground">
                  <Award className="w-16 h-16 text-primary/40 mb-2" />
                  <span className="text-xs uppercase tracking-wider font-semibold text-foreground/80">Certificado de Reconhecimento</span>
                </div>
              </div>
            )}

            {/* Interactive Text Fields Overlay */}
            {template.fields.map((field) => {
              const isSelected = selectedFieldId === field.id && !isPreview;
              const displayText = isPreview
                ? replacePlaceholders(field.text, sampleStudent, template.customText)
                : field.text;

              // Compute exact proportional font size (matching jsPDF A4 841.89pt width ratio)
              const scaledFontSize = Math.max(10, (field.fontSize / 841.89) * (containerWidth || 840));

              return (
                <div
                  key={field.id}
                  onMouseDown={(e) => handleMouseDown(e, field.id)}
                  className={`absolute cursor-move transition-all duration-75 flex items-center overflow-hidden ${
                    isSelected
                      ? 'ring-2 ring-primary ring-offset-1 bg-primary/10 z-20 rounded'
                      : 'hover:ring-1 hover:ring-primary/50 z-10'
                  }`}
                  style={{
                    left: `${field.xPercent}%`,
                    top: `${field.yPercent}%`,
                    width: `${field.widthPercent}%`,
                    height: `${field.heightPercent}%`,
                    justifyContent:
                      field.align === 'center'
                        ? 'center'
                        : field.align === 'right'
                        ? 'flex-end'
                        : 'flex-start',
                  }}
                >
                  <span
                    style={{
                      fontSize: `${scaledFontSize}px`,
                      fontFamily: field.fontFamily || 'sans-serif',
                      fontWeight: field.fontWeight?.includes('bold') ? 'bold' : 'normal',
                      fontStyle: field.fontWeight?.includes('italic') ? 'italic' : 'normal',
                      color: field.color || '#1e293b',
                      textAlign: field.align || 'center',
                    }}
                    className="w-full truncate block overflow-hidden text-ellipsis whitespace-nowrap leading-none px-1 pointer-events-none select-none"
                    title={displayText}
                  >
                    {displayText || '(Texto Vazio)'}
                  </span>

                  {/* Interactive Resize & Trash Handles */}
                  {isSelected && (
                    <>
                      {/* Delete Button */}
                      <div className="absolute -top-3 -right-3 z-30">
                        <Button
                          size="icon"
                          variant="destructive"
                          className="w-6 h-6 rounded-full shadow"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveField(field.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Right Resize Handle (Width) */}
                      <div
                        onMouseDown={(e) => handleResizeStart(e, field.id, 'e')}
                        className="absolute top-0 right-0 w-2 h-full cursor-e-resize bg-amber-500/60 hover:bg-amber-600 z-30 rounded-r flex items-center justify-center"
                        title="Arraste para alterar a largura da caixa"
                      >
                        <div className="w-0.5 h-4 bg-white/80 rounded" />
                      </div>

                      {/* Left Resize Handle (Position X & Width) */}
                      <div
                        onMouseDown={(e) => handleResizeStart(e, field.id, 'w')}
                        className="absolute top-0 left-0 w-2 h-full cursor-w-resize bg-amber-500/60 hover:bg-amber-600 z-30 rounded-l flex items-center justify-center"
                        title="Arraste para alterar a largura e posição da caixa"
                      >
                        <div className="w-0.5 h-4 bg-white/80 rounded" />
                      </div>

                      {/* Bottom Resize Handle (Height) */}
                      <div
                        onMouseDown={(e) => handleResizeStart(e, field.id, 's')}
                        className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize bg-amber-500/60 hover:bg-amber-600 z-30 rounded-b flex items-center justify-center"
                        title="Arraste para alterar a altura da caixa"
                      >
                        <div className="h-0.5 w-4 bg-white/80 rounded" />
                      </div>

                      {/* Bottom-Right Corner Handle (Width & Height) */}
                      <div
                        onMouseDown={(e) => handleResizeStart(e, field.id, 'se')}
                        className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-se-resize bg-amber-600 hover:bg-amber-700 z-40 rounded-tl shadow"
                        title="Arraste para redimensionar largura e altura"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Field Format Sidebar */}
        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4 overflow-hidden">
          <div className="font-semibold text-sm border-b pb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Type className="w-4 h-4 text-primary" />
              Formatação da Caixa
            </span>
            {selectedField && (
              <Badge variant="outline" className="text-xs truncate max-w-[110px]">
                {selectedField.name}
              </Badge>
            )}
          </div>

          {selectedField ? (
            <div className="space-y-4 text-xs">
              {/* Text Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Conteúdo do Texto / Variáveis</Label>
                <Input
                  value={selectedField.text}
                  onChange={(e) => handleUpdateSelectedField({ text: e.target.value })}
                  placeholder="Ex: Certificamos que {nome_aluno}"
                  className="text-xs"
                />
              </div>

              {/* Font Size Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-medium">
                  <Label className="text-xs">Tamanho da Fonte ({selectedField.fontSize}pt)</Label>
                </div>
                <Slider
                  value={[selectedField.fontSize]}
                  min={10}
                  max={72}
                  step={1}
                  onValueChange={([val]) => handleUpdateSelectedField({ fontSize: val })}
                />
              </div>

              {/* Width Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-medium">
                  <Label className="text-xs">Largura da Caixa ({selectedField.widthPercent}%)</Label>
                </div>
                <Slider
                  value={[selectedField.widthPercent]}
                  min={10}
                  max={100}
                  step={1}
                  onValueChange={([val]) => handleUpdateSelectedField({ widthPercent: val })}
                />
              </div>

              {/* Height Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-medium">
                  <Label className="text-xs">Altura da Caixa ({selectedField.heightPercent || 10}%)</Label>
                </div>
                <Slider
                  value={[selectedField.heightPercent || 10]}
                  min={4}
                  max={40}
                  step={1}
                  onValueChange={([val]) => handleUpdateSelectedField({ heightPercent: val })}
                />
              </div>

              {/* Font Style Controls */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Estilo do Texto</Label>
                <div className="flex items-center gap-1.5 w-full">
                  <Button
                    size="sm"
                    variant={selectedField.fontWeight?.includes('bold') ? 'default' : 'outline'}
                    className="h-8 px-2 flex-1 text-xs gap-1"
                    onClick={() => {
                      const isBold = selectedField.fontWeight?.includes('bold');
                      const isItalic = selectedField.fontWeight?.includes('italic');
                      let next: any = 'normal';
                      if (!isBold && isItalic) next = 'bolditalic';
                      else if (!isBold && !isItalic) next = 'bold';
                      else if (isBold && isItalic) next = 'italic';
                      handleUpdateSelectedField({ fontWeight: next });
                    }}
                  >
                    <Bold className="w-3.5 h-3.5" />
                    <span>Negrito</span>
                  </Button>

                  <Button
                    size="sm"
                    variant={selectedField.fontWeight?.includes('italic') ? 'default' : 'outline'}
                    className="h-8 px-2 flex-1 text-xs gap-1"
                    onClick={() => {
                      const isBold = selectedField.fontWeight?.includes('bold');
                      const isItalic = selectedField.fontWeight?.includes('italic');
                      let next: any = 'normal';
                      if (!isItalic && isBold) next = 'bolditalic';
                      else if (!isItalic && !isBold) next = 'italic';
                      else if (isItalic && isBold) next = 'bold';
                      handleUpdateSelectedField({ fontWeight: next });
                    }}
                  >
                    <Italic className="w-3.5 h-3.5" />
                    <span>Itálico</span>
                  </Button>
                </div>
              </div>

              {/* Alignment Controls */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Alinhamento</Label>
                <div className="flex items-center gap-1 w-full">
                  <Button
                    size="sm"
                    variant={selectedField.align === 'left' ? 'default' : 'outline'}
                    className="h-8 px-1.5 flex-1 min-w-0"
                    title="Alinhar à Esquerda"
                    onClick={() => handleUpdateSelectedField({ align: 'left' })}
                  >
                    <AlignLeft className="w-3.5 h-3.5 shrink-0" />
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedField.align === 'center' ? 'default' : 'outline'}
                    className="h-8 px-1.5 flex-1 min-w-0"
                    title="Centralizado"
                    onClick={() => handleUpdateSelectedField({ align: 'center' })}
                  >
                    <AlignCenter className="w-3.5 h-3.5 shrink-0" />
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedField.align === 'right' ? 'default' : 'outline'}
                    className="h-8 px-1.5 flex-1 min-w-0"
                    title="Alinhar à Direita"
                    onClick={() => handleUpdateSelectedField({ align: 'right' })}
                  >
                    <AlignRight className="w-3.5 h-3.5 shrink-0" />
                  </Button>
                </div>
              </div>

              {/* Color Picker & Font Family */}
              <div className="space-y-2 pt-1 border-t">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Cor do Texto</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedField.color || '#1e293b'}
                      onChange={(e) => handleUpdateSelectedField({ color: e.target.value })}
                      className="w-8 h-8 rounded border cursor-pointer p-0"
                    />
                    <Input
                      value={selectedField.color || '#1e293b'}
                      onChange={(e) => handleUpdateSelectedField({ color: e.target.value })}
                      className="text-xs font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Tipo de Fonte</Label>
                  <Select
                    value={selectedField.fontFamily || 'helvetica'}
                    onValueChange={(val: any) => handleUpdateSelectedField({ fontFamily: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="helvetica">Helvetica / Sans-Serif</SelectItem>
                      <SelectItem value="times">Times New Roman / Serif</SelectItem>
                      <SelectItem value="courier">Courier / Monospace</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Delete Button */}
              <Button
                variant="outline"
                color="destructive"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 text-xs mt-2 gap-2"
                onClick={() => handleRemoveField(selectedField.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Esta Caixa
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
              <p>Clique em qualquer caixa de texto no certificado para alterar tamanho, cores e fontes.</p>
              <p className="text-[11px] text-primary font-medium">Ou clique nos botões de "Variáveis Dinâmicas" acima para adicionar novas informações.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
