import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeFile, readTextFile } from "@tauri-apps/plugin-fs";

export function DataBackup() {
  const store = useStore();

  const handleExport = async () => {
    try {
      const data = {
        schoolConfig: store.schoolConfig,
        professors: store.professors,
        subjects: store.subjects,
        classes: store.classes,
        lessons: store.lessons,
        stages: store.stages,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const filePath = await save({
        defaultPath: `gestao-escolar-backup-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      if (!filePath) return;

      const content = JSON.stringify(data, null, 2);
      // writeFile expects Uint8Array or string. 
      // If it's string, it writes pure string. 
      // But verify if @tauri-apps/plugin-fs writeFile supports string directly or needs encoder.
      // Usually it expects Uint8Array. TextEncoder handles it.
      await writeFile(filePath, new TextEncoder().encode(content));
      
      toast.success("Dados exportados com sucesso!");
    } catch (error) {
       console.error(error);
       toast.error("Erro ao exportar dados.");
    }
  };

  const handleImportClick = async () => {
    try {
        const filePath = await open({
             multiple: false,
             filters: [{ name: "JSON", extensions: ["json"] }]
        });
        
        if (!filePath || typeof filePath !== 'string') return;

        const content = await readTextFile(filePath);
        const data = JSON.parse(content);
        
        // Basic validation
        if (!data.schoolConfig || !Array.isArray(data.professors)) {
            throw new Error("Formato de arquivo inválido");
        }

        // Confirm
        // We can use Tauri dialog for confirmation too, or window.confirm
        if (window.confirm("Isso substituirá todos os dados atuais. Deseja continuar?")) {
            store.loadData(data);
            toast.success("Dados importados com sucesso!");
        }
      } catch (error) {
        console.error(error);
        toast.error("Erro ao importar dados. Verifique o formato do arquivo.");
      }
  };

  return (
    <div className="flex items-center gap-2">
      
      <Button variant="outline" size="sm" onClick={handleExport} title="Exportar Backup">
        <Download className="w-4 h-4 mr-2" />
        <span className="hidden sm:inline">Exportar</span>
      </Button>
      
      <Button variant="outline" size="sm" onClick={handleImportClick} title="Importar Backup">
        <Upload className="w-4 h-4 mr-2" />
        <span className="hidden sm:inline">Importar</span>
      </Button>
    </div>
  );
}
