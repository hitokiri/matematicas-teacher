import { check, type Update, type DownloadEvent } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'

export type { Update, DownloadEvent }

/** Versión instalada de la app (la del tauri.conf.json con la que se compiló) */
export async function currentVersion(): Promise<string> {
  return await getVersion()
}

/** Pregunta al endpoint si hay una versión nueva; null si estás al día */
export async function checkForUpdate(): Promise<Update | null> {
  return await check()
}

/** Descarga e instala la actualización; onEvent da el progreso. En Windows la app se cierra sola al lanzar el instalador. */
export async function installUpdate(update: Update, onEvent?: (e: DownloadEvent) => void): Promise<void> {
  await update.downloadAndInstall(onEvent)
}

/** Reinicia la app para arrancar con la nueva versión */
export async function restartApp(): Promise<void> {
  await relaunch()
}
