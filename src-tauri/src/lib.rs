use std::process::Command;
use std::path::PathBuf;
use std::fs;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn resolve_agenda_dir() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("agenda"),
        PathBuf::from("../agenda"),
        PathBuf::from("../../agenda"),
    ];
    for c in &candidates {
        if c.exists() && c.is_dir() {
            if let Ok(abs) = c.canonicalize() {
                return Some(abs);
            }
            return Some(c.clone());
        }
    }
    None
}

fn resolve_python_path() -> Option<(PathBuf, PathBuf)> {
    if let Some(agenda_dir) = resolve_agenda_dir() {
        let venv_py = agenda_dir.join(".venv").join("Scripts").join("python.exe");
        if venv_py.exists() {
            return Some((venv_py, agenda_dir));
        }
        let dist_exe = agenda_dir.join("dist").join("agenda_automacao").join("agenda_automacao.exe");
        if dist_exe.exists() {
            return Some((dist_exe, agenda_dir));
        }
        return Some((PathBuf::from("python"), agenda_dir));
    }
    None
}

#[tauri::command]
fn launch_agenda_automation() -> Result<String, String> {
    if let Some((py_bin, agenda_dir)) = resolve_python_path() {
        let is_exe = py_bin.to_string_lossy().ends_with("agenda_automacao.exe");
        
        let mut cmd = Command::new(&py_bin);
        if !is_exe {
            cmd.arg("main.py").arg("--start");
        } else {
            cmd.arg("--start");
        }
        cmd.current_dir(&agenda_dir);

        match cmd.spawn() {
            Ok(_) => Ok("Navegador Chromium iniciado com sucesso para conferência assistida!".into()),
            Err(e) => Err(format!("Falha ao iniciar automação: {}", e)),
        }
    } else {
        Err("Pasta da agenda não foi localizada.".into())
    }
}

#[tauri::command]
fn start_agenda_server() -> Result<String, String> {
    if let Some((py_bin, agenda_dir)) = resolve_python_path() {
        let server_script = agenda_dir.join("interface").join("server.py");
        let mut cmd = Command::new(&py_bin);
        cmd.arg(&server_script);
        cmd.current_dir(&agenda_dir);
        
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        match cmd.spawn() {
            Ok(_) => Ok("Servidor iniciado em segundo plano.".into()),
            Err(e) => Err(format!("Falha ao iniciar servidor: {}", e)),
        }
    } else {
        Err("Pasta da agenda não localizada.".into())
    }
}

#[tauri::command]
fn load_agenda_activities() -> Result<String, String> {
    if let Some(agenda_dir) = resolve_agenda_dir() {
        let file_path = agenda_dir.join("agenda_extraida.json");
        if file_path.exists() {
            fs::read_to_string(&file_path).map_err(|e| e.to_string())
        } else {
            Ok("[]".into())
        }
    } else {
        Err("Pasta agenda não encontrada".into())
    }
}

#[tauri::command]
fn save_agenda_activities(data: String) -> Result<(), String> {
    if let Some(agenda_dir) = resolve_agenda_dir() {
        let file_path = agenda_dir.join("agenda_extraida.json");
        fs::write(&file_path, data).map_err(|e| e.to_string())
    } else {
        Err("Pasta agenda não encontrada".into())
    }
}

#[tauri::command]
fn get_agenda_progress() -> Result<String, String> {
    if let Some(agenda_dir) = resolve_agenda_dir() {
        let file_path = agenda_dir.join("progresso.json");
        if file_path.exists() {
            fs::read_to_string(&file_path).map_err(|e| e.to_string())
        } else {
            Ok("{\"concluidos_ids\": []}".into())
        }
    } else {
        Err("Pasta agenda não encontrada".into())
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            launch_agenda_automation,
            start_agenda_server,
            load_agenda_activities,
            save_agenda_activities,
            get_agenda_progress
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
