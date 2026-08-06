import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import type { Student, ClassGroup } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StudentDetailsDialog } from '@/components/StudentDetailsDialog';
import { toast } from 'sonner';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  UserX,
  Search,
  Filter,
  FileSpreadsheet,
  Edit,
  ShieldAlert,
  HelpCircle,
  Sparkles,
  Users
} from 'lucide-react';

export type InconsistencySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface InconsistencyIssue {
  id: string;
  ruleKey: string;
  title: string;
  description: string;
  severity: InconsistencySeverity;
}

export interface StudentAuditItem {
  student: Student;
  classGroup: ClassGroup;
  issues: InconsistencyIssue[];
  maxSeverity: InconsistencySeverity;
}

const SEVERITY_WEIGHT: Record<InconsistencySeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const SEVERITY_CONFIG: Record<InconsistencySeverity, { label: string; badgeClass: string; borderClass: string; icon: any }> = {
  critical: {
    label: 'Crítica',
    badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900',
    borderClass: 'border-l-4 border-l-red-500',
    icon: ShieldAlert,
  },
  high: {
    label: 'Alta',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900',
    borderClass: 'border-l-4 border-l-orange-500',
    icon: AlertTriangle,
  },
  medium: {
    label: 'Média',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    borderClass: 'border-l-4 border-l-amber-500',
    icon: AlertCircle,
  },
  low: {
    label: 'Baixa',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    borderClass: 'border-l-4 border-l-blue-500',
    icon: HelpCircle,
  },
};

const RULE_LABELS: Record<string, string> = {
  missing_cpf: 'CPF Ausente',
  invalid_cpf: 'CPF Inválido',
  missing_birthdate: 'Sem Data de Nascimento',
  missing_mother: 'Sem Mãe / Responsável',
  missing_stage: 'Sem Sub-turma (Multiseriada)',
  missing_nis_sus: 'Sem NIS / Cartão SUS',
  duplicate_student: 'Cadastro Duplicado',
};

export function InconsistencyControl() {
  const classGroups = useStore((state) => state.classes) || [];
  const updateClassStudents = useStore((state) => state.updateClassStudents);

  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedRule, setSelectedRule] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editing dialog state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingClassGroup, setEditingClassGroup] = useState<ClassGroup | null>(null);

  // 1. Audit all students in the system
  const auditResults = useMemo(() => {
    const items: StudentAuditItem[] = [];
    const safeClasses = Array.isArray(classGroups) ? classGroups : [];

    // Map to check duplicates across all classes
    const studentCountByName = new Map<string, { count: number; classes: string[] }>();
    const studentCountByCpf = new Map<string, { count: number; classes: string[] }>();

    // Pass 1: Build duplicate lookup maps
    safeClasses.forEach((cls: ClassGroup) => {
      if (!cls) return;
      const safeStudents = Array.isArray(cls.students) ? cls.students : [];
      safeStudents.forEach((st: Student) => {
        if (!st || !st.name) return;
        const cleanName = st.name.trim().toLowerCase();
        if (cleanName) {
          const current = studentCountByName.get(cleanName) || { count: 0, classes: [] };
          current.count++;
          if (!current.classes.includes(cls.name)) current.classes.push(cls.name);
          studentCountByName.set(cleanName, current);
        }

        const cleanCpf = (st.cpf || '').replace(/\D/g, '');
        if (cleanCpf && cleanCpf.length === 11) {
          const current = studentCountByCpf.get(cleanCpf) || { count: 0, classes: [] };
          current.count++;
          if (!current.classes.includes(cls.name)) current.classes.push(cls.name);
          studentCountByCpf.set(cleanCpf, current);
        }
      });
    });

    // Pass 2: Audit individual student records
    safeClasses.forEach((cls: ClassGroup) => {
      if (!cls) return;
      const isMultigrade = !!(cls.subStages && cls.subStages.length > 0);
      const safeStudents = Array.isArray(cls.students) ? cls.students : [];

      safeStudents.forEach((st: Student) => {
        if (!st || !st.name) return;
        const issues: InconsistencyIssue[] = [];

        // Check 1: Missing CPF
        const cleanCpf = (st.cpf || '').replace(/\D/g, '');
        if (!st.cpf || st.cpf.trim() === '') {
          issues.push({
            id: `${st.id}-missing_cpf`,
            ruleKey: 'missing_cpf',
            title: 'CPF não cadastrado',
            description: 'O número de CPF do aluno está em branco.',
            severity: 'high',
          });
        } else if (cleanCpf.length !== 11) {
          issues.push({
            id: `${st.id}-invalid_cpf`,
            ruleKey: 'invalid_cpf',
            title: 'CPF com formato incorreto',
            description: `CPF informado ("${st.cpf}") possui ${cleanCpf.length} dígitos (esperado: 11).`,
            severity: 'high',
          });
        }

        // Check 2: Missing Birth Date
        if (!st.birthDate || st.birthDate.trim() === '') {
          issues.push({
            id: `${st.id}-missing_birthdate`,
            ruleKey: 'missing_birthdate',
            title: 'Data de nascimento ausente',
            description: 'A data de nascimento do aluno não foi preenchida.',
            severity: 'high',
          });
        }

        // Check 3: Missing Mother or Guardian Name
        const hasMother = st.motherName && st.motherName.trim().length > 0;
        const hasResponsible = st.responsibleName && st.responsibleName.trim().length > 0;
        const hasResponsiblesList = st.responsibles && st.responsibles.length > 0;

        if (!hasMother && !hasResponsible && !hasResponsiblesList) {
          issues.push({
            id: `${st.id}-missing_mother`,
            ruleKey: 'missing_mother',
            title: 'Sem Filiação / Responsável',
            description: 'Nenhum nome de mãe, pai ou responsável legal cadastrado.',
            severity: 'medium',
          });
        }

        // Check 4: Missing Sub-stage badge in Multigrade classes
        if (isMultigrade && (!st.stage || st.stage.trim() === '')) {
          issues.push({
            id: `${st.id}-missing_stage`,
            ruleKey: 'missing_stage',
            title: 'Sub-turma / Etapa não atribuída',
            description: `Turma multiseriada "${cls.name}" possui etapas (${cls.subStages?.join(', ')}), mas o aluno não possui etapa definida.`,
            severity: 'critical',
          });
        }

        // Check 5: Missing NIS / Cartão SUS
        const hasNis = st.nis && st.nis.trim().length > 0;
        const hasSus = st.sus && st.sus.trim().length > 0;
        if (!hasNis && !hasSus) {
          issues.push({
            id: `${st.id}-missing_nis_sus`,
            ruleKey: 'missing_nis_sus',
            title: 'NIS / Cartão SUS pendente',
            description: 'Campos de NIS e Cartão SUS encontram-se em branco.',
            severity: 'low',
          });
        }

        // Check 6: Duplicate Student Check
        const cleanName = st.name.trim().toLowerCase();
        const nameDup = studentCountByName.get(cleanName);
        const cpfDup = cleanCpf.length === 11 ? studentCountByCpf.get(cleanCpf) : undefined;

        if ((nameDup && nameDup.count > 1) || (cpfDup && cpfDup.count > 1)) {
          const dupClasses = Array.from(new Set([...(nameDup?.classes || []), ...(cpfDup?.classes || [])])).join(', ');
          issues.push({
            id: `${st.id}-duplicate`,
            ruleKey: 'duplicate_student',
            title: 'Possível registro em duplicidade',
            description: `Aluno ou CPF consta mais de uma vez no sistema (Turmas: ${dupClasses}).`,
            severity: 'critical',
          });
        }

        if (issues.length > 0) {
          // Determine maximum severity
          let maxSev: InconsistencySeverity = 'low';
          issues.forEach((iss) => {
            if (SEVERITY_WEIGHT[iss.severity] > SEVERITY_WEIGHT[maxSev]) {
              maxSev = iss.severity;
            }
          });

          items.push({
            student: st,
            classGroup: cls,
            issues,
            maxSeverity: maxSev,
          });
        }
      });
    });

    // Sort by severity (critical first) then student name
    return items.sort((a, b) => {
      const diff = SEVERITY_WEIGHT[b.maxSeverity] - SEVERITY_WEIGHT[a.maxSeverity];
      if (diff !== 0) return diff;
      return a.student.name.localeCompare(b.student.name, 'pt-BR');
    });
  }, [classGroups]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalStudents = 0;
    const safeClasses = Array.isArray(classGroups) ? classGroups : [];
    safeClasses.forEach((cls: ClassGroup) => {
      if (cls && Array.isArray(cls.students)) {
        totalStudents += cls.students.length;
      }
    });

    const flaggedCount = auditResults.length;
    const cleanCount = Math.max(0, totalStudents - flaggedCount);
    const criticalCount = auditResults.filter((i) => i.maxSeverity === 'critical').length;
    const highCount = auditResults.filter((i) => i.maxSeverity === 'high').length;
    const mediumCount = auditResults.filter((i) => i.maxSeverity === 'medium').length;
    const lowCount = auditResults.filter((i) => i.maxSeverity === 'low').length;

    return {
      totalStudents,
      flaggedCount,
      cleanCount,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      healthPercentage: totalStudents > 0 ? Math.round((cleanCount / totalStudents) * 100) : 100,
    };
  }, [classGroups, auditResults]);

  // Filtered audit list
  const filteredAuditResults = useMemo(() => {
    return auditResults.filter((item) => {
      if (!item || !item.student || !item.classGroup) return false;

      // Filter by Class
      if (selectedClassId !== 'all' && item.classGroup.id !== selectedClassId) {
        return false;
      }

      // Filter by Severity
      if (selectedSeverity !== 'all' && item.maxSeverity !== selectedSeverity) {
        return false;
      }

      // Filter by Rule Key
      if (selectedRule !== 'all') {
        const hasRule = item.issues.some((iss) => iss.ruleKey === selectedRule);
        if (!hasRule) return false;
      }

      // Filter by Search Query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const matchName = item.student.name.toLowerCase().includes(query);
        const matchCpf = (item.student.cpf || '').includes(query);
        const matchClass = item.classGroup.name.toLowerCase().includes(query);
        if (!matchName && !matchCpf && !matchClass) return false;
      }

      return true;
    });
  }, [auditResults, selectedClassId, selectedSeverity, selectedRule, searchQuery]);

  // Handle Edit Action
  const handleOpenEdit = (student: Student, classGroup: ClassGroup) => {
    setEditingStudent(student);
    setEditingClassGroup(classGroup);
  };

  const handleSaveStudent = (updatedStudent: Student) => {
    if (editingClassGroup && updateClassStudents) {
      const currentStudents = Array.isArray(editingClassGroup.students) ? editingClassGroup.students : [];
      const newStudents = currentStudents.map((s) => (s.id === updatedStudent.id ? updatedStudent : s));
      updateClassStudents(editingClassGroup.id, newStudents);
      toast.success(`Dados do aluno "${updatedStudent.name}" atualizados com sucesso!`);
    }
    setEditingStudent(null);
    setEditingClassGroup(null);
  };

  // CSV Export
  const handleExportCsv = () => {
    if (filteredAuditResults.length === 0) {
      toast.error('Nenhuma inconsistência filtrada para exportar.');
      return;
    }

    const headers = ['Turma', 'Sub-turma/Etapa', 'ID Aluno', 'Nome do Aluno', 'CPF', 'Severidade Máxima', 'Inconsistências Encontradas'];
    const rows = filteredAuditResults.map((item) => {
      const issueTitles = item.issues.map((i) => i.title).join('; ');
      return [
        `"${item.classGroup.name}"`,
        `"${item.student.stage || '-'}"`,
        `"${item.student.id}"`,
        `"${item.student.name}"`,
        `"${item.student.cpf || '-'}"`,
        `"${SEVERITY_CONFIG[item.maxSeverity]?.label || 'Baixa'}"`,
        `"${issueTitles}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_inconsistencias_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Relatório CSV exportado com sucesso!');
  };

  const safeClassesList = Array.isArray(classGroups) ? classGroups : [];

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 rounded-xl border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Relatório de Inconsistências de Dados</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Auditoria Automática
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Identifique cadastros incompletos, CPF ausente, falta de responsável e alunos pendentes de sub-turma.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Alunos</CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">Cadastrados em todas as turmas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cadastros Regulares</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600">{stats.cleanCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.healthPercentage}% com dados completos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inconsistências Pendentes</CardTitle>
            <UserX className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-red-600">{stats.flaggedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Alunos requerem atenção</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gravidade Alta / Crítica</CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-600">{stats.criticalCount + stats.highCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.criticalCount} Críticas, {stats.highCount} Altas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls Bar */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              Filtros da Auditoria
            </CardTitle>
            {filteredAuditResults.length !== auditResults.length && (
              <Badge variant="secondary" className="text-xs">
                Exibindo {filteredAuditResults.length} de {auditResults.length} inconsistências
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Class Filter */}
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as Turmas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Turmas ({safeClassesList.length})</SelectItem>
                {safeClassesList.map((cls: ClassGroup, idx: number) => {
                  const val = cls.id || `cls-${idx}`;
                  return (
                    <SelectItem key={val} value={val}>
                      {cls.name} ({(Array.isArray(cls.students) ? cls.students : []).length} alunos)
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Severity Filter */}
            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as Severidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Severidades</SelectItem>
                <SelectItem value="critical">Crítica ({stats.criticalCount})</SelectItem>
                <SelectItem value="high">Alta ({stats.highCount})</SelectItem>
                <SelectItem value="medium">Média ({stats.mediumCount})</SelectItem>
                <SelectItem value="low">Baixa ({stats.lowCount})</SelectItem>
              </SelectContent>
            </Select>

            {/* Rule Filter */}
            <Select value={selectedRule} onValueChange={setSelectedRule}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Inconsistência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {Object.entries(RULE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Data Table */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Lista de Inconsistências Identificadas ({filteredAuditResults.length})
          </CardTitle>
          <CardDescription>
            Clique em <strong>"Corrigir"</strong> na linha do aluno para atualizar as informações faltantes.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="w-full min-w-[700px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">#</TableHead>
                <TableHead className="min-w-[160px]">Aluno</TableHead>
                <TableHead className="min-w-[140px]">Turma / Etapa</TableHead>
                <TableHead className="min-w-[120px]">CPF</TableHead>
                <TableHead className="min-w-[90px]">Gravidade</TableHead>
                <TableHead className="min-w-[220px]">Problemas Identificados</TableHead>
                <TableHead className="w-24 text-right pr-4">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAuditResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    {auditResults.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        <span className="text-base font-semibold text-foreground">Nenhuma inconsistência encontrada!</span>
                        <span className="text-sm text-muted-foreground">
                          Todos os cadastros dos alunos estão com os dados essenciais preenchidos.
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="w-8 h-8 text-muted-foreground" />
                        <span>Nenhum aluno encontrado para os filtros selecionados.</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAuditResults.map((item, index) => {
                  const SevConfig = SEVERITY_CONFIG[item.maxSeverity] || SEVERITY_CONFIG.low;
                  const SevIcon = SevConfig.icon || HelpCircle;

                  return (
                    <TableRow key={`${item.classGroup.id}-${item.student.id}`} className={SevConfig.borderClass}>
                      <TableCell className="text-muted-foreground text-xs font-mono">{index + 1}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground">{item.student.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">ID: {item.student.id}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{item.classGroup.name}</div>
                        {item.student.stage ? (
                          <Badge variant="outline" className="text-xs mt-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            {item.student.stage}
                          </Badge>
                        ) : (
                          item.classGroup.subStages && item.classGroup.subStages.length > 0 && (
                            <Badge variant="outline" className="text-xs mt-0.5 bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400 border-red-300">
                              Sem Sub-turma
                            </Badge>
                          )
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-mono">
                          {item.student.cpf ? item.student.cpf : <span className="text-red-500 italic">Ausente</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1.5 px-2 py-0.5 font-semibold text-xs ${SevConfig.badgeClass}`}>
                          <SevIcon className="w-3.5 h-3.5" />
                          {SevConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {item.issues.map((issue) => (
                            <div
                              key={issue.id}
                              className="text-xs bg-muted border px-2 py-1 rounded-md flex flex-col gap-0.5 max-w-xs"
                              title={issue.description}
                            >
                              <span className="font-semibold text-foreground">{issue.title}</span>
                              <span className="text-[11px] text-muted-foreground">{issue.description}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                          onClick={() => handleOpenEdit(item.student, item.classGroup)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Corrigir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Editing Dialog Modal */}
      {editingStudent && editingClassGroup && (
        <StudentDetailsDialog
          isOpen={!!editingStudent}
          onClose={() => {
            setEditingStudent(null);
            setEditingClassGroup(null);
          }}
          student={editingStudent}
          classId={editingClassGroup.id}
          onUpdate={handleSaveStudent}
        />
      )}
    </div>
  );
}
