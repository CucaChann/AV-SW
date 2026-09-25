//! File access for user documents chosen in AV-SW.
//!
//! The fs plugin only allows paths picked in a dialog during the current
//! session, which breaks "Recent projects". These commands allow any path but
//! only for AV-SW's own document types.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use percent_encoding::percent_decode_str;
use tauri::ipc::{InvokeBody, Request, Response};

const READABLE_EXTENSIONS: [&str; 3] = ["avsw", "pdf", "dxf"];
const PROJECT_EXTENSION: &str = "avsw";
/// Header carrying the percent-encoded target path (headers must be ASCII).
const PATH_HEADER: &str = "x-avsw-path";

fn has_extension(path: &Path, allowed: &[&str]) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| allowed.iter().any(|a| extension.eq_ignore_ascii_case(a)))
        .unwrap_or(false)
}

/// Reads a project or drawing file and returns its bytes.
#[tauri::command]
pub fn read_user_file(path: String) -> Result<Response, String> {
    let path = PathBuf::from(path);
    if !has_extension(&path, &READABLE_EXTENSIONS) {
        return Err("AV-SW can only open .avsw, .pdf and .dxf files.".into());
    }
    fs::read(&path)
        .map(Response::new)
        .map_err(|error| format!("Could not read {}: {error}", path.display()))
}

/// Saves a project file atomically: write a temporary file next to the target,
/// flush it to disk, then rename it over the target. A crash or full disk
/// mid-save leaves the previous version intact.
#[tauri::command]
pub fn write_project_file(request: Request<'_>) -> Result<(), String> {
    let encoded = request
        .headers()
        .get(PATH_HEADER)
        .and_then(|value| value.to_str().ok())
        .ok_or("Missing target path.")?;
    let decoded = percent_decode_str(encoded)
        .decode_utf8()
        .map_err(|_| "Target path is not valid UTF-8.")?;
    let target = PathBuf::from(decoded.as_ref());
    if !has_extension(&target, &[PROJECT_EXTENSION]) {
        return Err("Projects can only be saved as .avsw files.".into());
    }

    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected the project file contents.".into());
    };

    let temporary = target.with_extension("avsw.saving");
    let result = (|| -> std::io::Result<()> {
        let mut file = fs::File::create(&temporary)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&temporary, &target)
    })();

    result.map_err(|error| {
        let _ = fs::remove_file(&temporary);
        format!("Could not save {}: {error}", target.display())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extension_check_is_case_insensitive_and_strict() {
        assert!(has_extension(Path::new("C:/Jobs/Smith.AVSW"), &READABLE_EXTENSIONS));
        assert!(has_extension(Path::new("/plans/Level 1.dxf"), &READABLE_EXTENSIONS));
        assert!(!has_extension(Path::new("/etc/passwd"), &READABLE_EXTENSIONS));
        assert!(!has_extension(Path::new("/tmp/project.avsw.exe"), &READABLE_EXTENSIONS));
    }
}
