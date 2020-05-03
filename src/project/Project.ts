import { Config } from './../Config';
import { ProjectData } from './../model/ProjectData';
import { promises as fs } from "fs";
import { join } from "path";
import { CreateBuildFiles } from './BuildFiles';
import { createHash } from "crypto";

function hash(data: any): string {
	return createHash("md5").update(data).digest("hex");
};

/**
 * Správa lokální složky projektu
 */
export class Project{
	/** Mapování lokálních souborů k originálním cestám klienta */
	public MapToOriginalPath: {[hashed: string]: string} = {};

	private ProjConf: ProjectData;
	public Path?: string;

	public constructor(project: ProjectData){
		this.ProjConf = project;
	}

	private CrossPlatformBasename(path: string): string{
		let splitPath = path.split(/[\\\/]/);
		if(splitPath.length <= 1) throw new Error("Unable to create header file, invalid path");
		return splitPath.pop() ?? path;
	}

	public async CreateDirectory(): Promise<string>{
		if(this.Path) await this.Delete();

		const path = await fs.mkdtemp(join(Config.ProjectsFolder, "project-"));
		this.Path = path;

		for (const file of this.ProjConf.Fpga.Files) {
			const origPath = file.Path;
			file.Path = hash(origPath) + ".vhd";
			this.MapToOriginalPath[file.Path] = origPath;

			await fs.writeFile(join(path, file.Path), new Buffer(file.Content, "base64"));
		}

		for (const file of this.ProjConf.Mcu.Files) {
			const origPath = file.Path;
			file.Path = this.CrossPlatformBasename(origPath);
			this.MapToOriginalPath[file.Path] = origPath;

			await fs.writeFile(join(path, file.Path), new Buffer(file.Content, "base64"));
		}

		for (const file of this.ProjConf.Mcu.Headers) {
			const origPath = file.Path;
			file.Path = this.CrossPlatformBasename(origPath);
			this.MapToOriginalPath[file.Path] = origPath;

			await fs.writeFile(join(path, file.Path), new Buffer(file.Content, "base64"));
		}

		const ucf = this.ProjConf.Fpga.UcfFile;
		const origUcfPath = ucf.Path;
		this.MapToOriginalPath[ucf.Path] = origUcfPath;
		ucf.Path = hash(origUcfPath) + ".ucf";
		await fs.writeFile(join(path, ucf.Path), new Buffer(ucf.Content, "base64"));

		const isimFile = this.ProjConf.Fpga.IsimFile;
		if(isimFile){
			const localIsimFile = join(path, "isim.tcl");
			this.MapToOriginalPath[localIsimFile] = isimFile.Path;
			await fs.writeFile(localIsimFile, new Buffer(isimFile.Content, "base64"));
		}

		CreateBuildFiles(this.Path, this.ProjConf);

		return path;
	}

	public async Delete(){
		if(!this.Path) return;

		fs.rmdir(this.Path, {recursive: true});
	}
}