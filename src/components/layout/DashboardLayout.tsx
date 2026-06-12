import { useState } from 'react';
import {
    LayoutDashboard,
    BookOpen,
    Users,
    GraduationCap,
    Calendar,
    ClipboardList,
    UserMinus,
    Settings,
    Menu,
    Search,
    TableProperties,
    BarChart3
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { ExternalLoginDialog } from '@/components/ExternalLoginDialog';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "@/components/mode-toggle";
import { DataBackup } from './DataBackup';
import { LogIn, LogOut } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const clipboardListIcon = ClipboardList;

const sidebarItems = [
  { id: 'config', label: 'Dashboard / Config', icon: LayoutDashboard },
  { id: 'subjects', label: 'Disciplinas', icon: BookOpen },
  { id: 'professors', label: 'Professores', icon: Users },
  { id: 'classes', label: 'Turmas', icon: GraduationCap },
  { id: 'schedule', label: 'Horário Escolar', icon: Calendar },
  { id: 'attendance', label: 'Frequência', icon: ClipboardList },
  { id: 'infrequency', label: 'Infrequência', icon: UserMinus },
  { id: 'tables', label: 'Tabelas', icon: TableProperties },
  { id: 'charts', label: 'Gráficos', icon: BarChart3 },
  { id: 'reports', label: 'Relatórios', icon: clipboardListIcon },
];

export function DashboardLayout({ children, activeTab, onTabChange }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { 
    externalSessions, 
    logoutExternalSystem, 
    isSGEduLoginOpen, 
    setSGEduLoginOpen,
    isSaevLoginOpen,
    setSaevLoginOpen 
  } = useStore();
  
  const sgeduUser = externalSessions['sgedu'];
  const saevUser = externalSessions['saev'];

  return (
    <div className="h-screen bg-muted/40 flex overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-background border-r transition-all duration-300 md:flex flex-col h-full hidden",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <div className="h-16 flex items-center px-6 border-b shrink-0">
          <div className="flex items-center gap-2 font-bold text-xl text-primary">
             <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
                <Calendar className="w-5 h-5" />
             </div>
             {!collapsed && <span>Gestão Escolar</span>}
          </div>
        </div>

        <ScrollArea className="flex-1 py-4">
          <div className="px-3 space-y-1">
            {sidebarItems.map((item) => (
              <Button
                key={item.id}
                variant={activeTab === item.id ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 mb-1",
                  activeTab === item.id && "bg-accent text-accent-foreground",
                  collapsed && "justify-center px-2"
                )}
                onClick={() => onTabChange(item.id)}
              >
                <item.icon className={cn("w-5 h-5", activeTab === item.id && "text-primary")} />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            ))}
          </div>
          
          <Separator className="my-4 mx-4 w-auto" />
          
          <div className="px-3 space-y-1">
             <Button variant="ghost" className="w-full justify-start gap-3" disabled>
                <Settings className="w-5 h-5 text-muted-foreground" />
                {!collapsed && <span className="text-muted-foreground">Settings</span>}
             </Button>
          </div>
        </ScrollArea>
        
        {/* User Profiles - Bottom */}
        <div className="p-4 border-t mt-auto space-y-4">
            {/* SGEdu Profile */}
            {sgeduUser ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className={cn("flex items-center gap-3 cursor-pointer hover:bg-accent rounded-md p-2 transition-colors", collapsed && "justify-center")}>
                             <Avatar>
                                <AvatarImage src={sgeduUser.photoUrl} />
                                <AvatarFallback className="bg-primary/20 text-primary">{sgeduUser.name.charAt(0)}</AvatarFallback>
                             </Avatar>
                             {!collapsed && (
                                 <div className="flex flex-col overflow-hidden text-left">
                                     <span className="text-sm font-medium truncate" title={sgeduUser.name}>{sgeduUser.name}</span>
                                     <span className="text-xs text-muted-foreground truncate" title={sgeduUser.email}>{sgeduUser.email}</span>
                                 </div>
                             )}
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Conta SGEdu</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => logoutExternalSystem('sgedu')} className="text-destructive focus:text-destructive cursor-pointer">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Sair (SGEdu)</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <Button 
                    variant="outline" 
                    className={cn("w-full gap-2", collapsed && "px-2")} 
                    onClick={() => setSGEduLoginOpen(true)}
                >
                    <LogIn className="w-4 h-4" />
                    {!collapsed && "Entrar no SGEdu"}
                </Button>
            )}

            {/* SAEV Profile */}
            {saevUser ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className={cn("flex items-center gap-3 cursor-pointer hover:bg-accent rounded-md p-2 transition-colors", collapsed && "justify-center")}>
                             <Avatar>
                                <AvatarImage src={saevUser.photoUrl} />
                                <AvatarFallback className="bg-green-100 text-green-700">{saevUser.name.charAt(0)}</AvatarFallback>
                             </Avatar>
                             {!collapsed && (
                                 <div className="flex flex-col overflow-hidden text-left">
                                     <span className="text-sm font-medium truncate" title={saevUser.name}>{saevUser.name}</span>
                                     <span className="text-xs text-muted-foreground truncate" title={saevUser.email}>{saevUser.email}</span>
                                 </div>
                             )}
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Conta SAEV</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => logoutExternalSystem('saev')} className="text-destructive focus:text-destructive cursor-pointer">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Sair (SAEV)</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <Button 
                    variant="outline" 
                    className={cn("w-full gap-2 border-green-200 hover:bg-green-50 text-green-700", collapsed && "px-2")} 
                    onClick={() => setSaevLoginOpen(true)}
                >
                    <LogIn className="w-4 h-4" />
                    {!collapsed && "Entrar no SAEV"}
                </Button>
            )}
        </div>
      </aside>
      
      <ExternalLoginDialog system="sgedu" isOpen={isSGEduLoginOpen} onClose={() => setSGEduLoginOpen(false)} />
      <ExternalLoginDialog system="saev" isOpen={isSaevLoginOpen} onClose={() => setSaevLoginOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-background border-b px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {/* Mobile Sheet/Menu trigger would go here if we had sheet, for now simple toggle */}
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="md:hidden">
              <Menu className="w-5 h-5" />
            </Button>
            <div className="hidden md:flex items-center text-muted-foreground text-sm">
                <span className="hover:text-foreground cursor-pointer">App</span>
                <span className="mx-2">/</span>
                <span className="text-foreground font-medium">{sidebarItems.find(i => i.id === activeTab)?.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="relative hidden md:block">
                 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                 <Input className="w-64 pl-9 bg-muted border-input" placeholder="Search or type a command" />
             </div>
             <ModeToggle />
             <DataBackup />
          </div>
        </header>

        {/* Scrollable Page Content */}
        <ScrollArea className="flex-1">
            <main className="p-6 md:p-8 min-h-full flex flex-col">
                <div className="max-w-7xl mx-auto space-y-6 flex-1 flex flex-col w-full">

                    
                    {children}
                </div>
            </main>
        </ScrollArea>
      </div>
    </div>
  );
}
