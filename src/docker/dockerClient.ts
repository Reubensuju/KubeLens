import * as cp from 'child_process';

export interface DockerContainer {
    id: string;
    name: string;
    image: string;
    status: string;
    state: string; // "running", "exited", "created", etc.
}

export class DockerClient {
    public static async getContainers(): Promise<DockerContainer[] | null> {
        return new Promise((resolve) => {
            cp.exec('docker ps -a --format "{{json .}}"', (error, stdout, stderr) => {
                if (error) {
                    console.error('Docker error:', stderr);
                    return resolve(null); // Return null if error or docker not running
                }

                try {
                    const lines = stdout.trim().split('\n').filter(l => l.length > 0);
                    const containers = lines.map(line => {
                        const parsed = JSON.parse(line);
                        return {
                            id: parsed.ID,
                            name: parsed.Names,
                            image: parsed.Image,
                            status: parsed.Status,
                            state: parsed.State
                        };
                    });
                    resolve(containers);
                } catch (e) {
                    console.error('Failed to parse docker output', e);
                    resolve([]);
                }
            });
        });
    }

    public static async getLogs(containerName: string, tail: number = 100): Promise<string> {
        return new Promise((resolve) => {
            cp.exec(`docker logs --tail ${tail} ${containerName}`, (error, stdout, stderr) => {
                resolve(`${stdout}\n${stderr}`);
            });
        });
    }

    public static async inspect(containerName: string): Promise<any> {
        return new Promise((resolve) => {
            cp.exec(`docker inspect ${containerName}`, (error, stdout) => {
                if (error) {
                    return resolve(null);
                }
                resolve(JSON.parse(stdout)[0]);
            });
        });
    }
}
